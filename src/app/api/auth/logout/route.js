import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function GET() {
  cookies().delete('user_id')
  redirect('/')
}
```

**Commit**

---

Teraz łączymy z Vercel! 

**Zrób tak:**

1. **Otwórz w nowej karcie:**
```
   https://vercel.com/
