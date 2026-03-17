import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function GET(request) {
  const cookieStore = cookies()
  const userId = cookieStore.get('user_id')?.value

  if (!userId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const businessIds = searchParams.get('business_ids') || 'all'
  const period = searchParams.get('period') || '30'
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')

  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  let businesses
  if (user?.role === 'admin') {
    const { data } = await supabase.from('businesses').select('*').order('title')
    businesses = data
  } else {
    const { data: permissions } = await supabase
      .from('business_permissions')
      .select('business_id')
      .eq('user_id', userId)
    const ids = permissions?.map(p => p.business_id) || []
    if (ids.length === 0) {
      return Response.json({ businesses: [], stats: {}, distribution: [], trend: [], ranking: [] })
    }
    const { data } = await supabase.from('businesses').select('*').in('id', ids).order('title')
    businesses = data
  }

  if (!businesses || businesses.length === 0) {
    return Response.json({ businesses: [], stats: {}, distribution: [], trend: [], ranking: [] })
  }

  const selectedIds = businessIds === 'all'
    ? businesses.map(b => b.id)
    : businessIds.split(',').filter(id => businesses.find(b => b.id === id))

  let reviewsQuery = supabase.from('reviews').select('*').in('business_id', selectedIds)

  if (period === 'custom' && dateFrom) {
    reviewsQuery = reviewsQuery.gte('create_time', dateFrom)
    if (dateTo) {
      reviewsQuery = reviewsQuery.lte('create_time', dateTo + 'T23:59:59.999Z')
    }
  } else if (parseInt(period) > 0) {
    const from = new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000).toISOString()
    reviewsQuery = reviewsQuery.gte('create_time', from)
  }

  const { data: reviews } = await reviewsQuery
  const allReviews = reviews || []

  const totalReviews = allReviews.length
  const avgRating = totalReviews > 0
    ? (allReviews.reduce((sum, r) => sum + r.star_rating, 0) / totalReviews).toFixed(1)
    : 0
  const unanswered = allReviews.filter(r => !r.has_reply).length
  const newReviews = allReviews.filter(r => r.is_new).length

  const distribution = [1, 2, 3, 4, 5].map(stars => ({
    stars,
    count: allReviews.filter(r => r.star_rating === stars).length
  }))

  const trendMap = {}
  allReviews.forEach(review => {
    const month = review.create_time?.substring(0, 7)
    if (!month) return
    if (!trendMap[month]) trendMap[month] = { sum: 0, count: 0 }
    trendMap[month].sum += review.star_rating
    trendMap[month].count++
  })
  const trend = Object.entries(trendMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, data]) => ({
      month,
      avgRating: (data.sum / data.count).toFixed(1),
      count: data.count
    }))

  const ranking = businesses
    .filter(b => selectedIds.includes(b.id))
    .map(business => {
      const bizReviews = allReviews.filter(r => r.business_id === business.id)
      const bizAvg = bizReviews.length > 0
        ? (bizReviews.reduce((sum, r) => sum + r.star_rating, 0) / bizReviews.length).toFixed(1)
        : 0
      return {
        id: business.id,
        title: business.title,
        avgRating: parseFloat(bizAvg),
        totalReviews: bizReviews.length,
        unanswered: bizReviews.filter(r => !r.has_reply).length
      }
    }).sort((a, b) => b.avgRating - a.avgRating)

  return Response.json({
    businesses,
    stats: { totalReviews, avgRating: parseFloat(avgRating), unanswered, newReviews },
    distribution,
    trend,
    ranking
  })
}
