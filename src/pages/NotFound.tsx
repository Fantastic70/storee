import { Link } from 'react-router-dom'
import { EmptyState } from '../components/Bits'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <EmptyState
        icon="search"
        title="الصفحة غير موجودة"
        description="يمكن الرابط قديم أو المنتج اتشال. جرّب ترجع للرئيسية."
        action={
          <Link to="/" className="btn-primary">
            رجوع للرئيسية
          </Link>
        }
      />
    </div>
  )
}
