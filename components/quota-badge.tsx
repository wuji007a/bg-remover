'use client'

import { useEffect, useState } from 'react'
import { Package, ArrowDown } from 'lucide-react'

interface QuotaData {
  prepaid: number
  free: number
  total: number
}

export default function QuotaBadge() {
  const [quota, setQuota] = useState<QuotaData>({
    prepaid: 0,
    free: 0,
    total: 0
  })
  const [loading, setLoading] = useState(true)

  // Fetch quota data
  useEffect(() => {
    fetchQuota()
  }, [])

  const fetchQuota = async () => {
    try {
      const res = await fetch('/api/quota')
      const data = await res.json()

      if (data.success) {
        setQuota(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch quota:', error)
    } finally {
      setLoading(false)
    }
  }

  // Quota status
  const isLow = quota.total <= 3 && quota.total > 0
  const isEmpty = quota.total === 0

  return (
    <div className="flex items-center gap-2">
      <div
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
          ${isEmpty
            ? 'bg-red-100 text-red-700 border border-red-300'
            : isLow
            ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
            : 'bg-green-100 text-green-700 border border-green-300'
          }
        `}
      >
        <Package className="w-4 h-4" />
        {loading ? (
          <span>Loading...</span>
        ) : (
          <span>
            Remaining: {quota.total} times
            {quota.prepaid > 0 && ` (${quota.prepaid} paid${quota.free > 0 ? ` + ${quota.free} free` : ''})`}
            {quota.prepaid === 0 && quota.free > 0 && ` (${quota.free} free)`}
          </span>
        )}
      </div>

      {isLow && !isEmpty && (
        <a
          href="/pricing"
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
        >
          <span>Buy</span>
          <ArrowDown className="w-4 h-4" />
        </a>
      )}
    </div>
  )
}
