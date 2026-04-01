// 配额显示组件使用示例

import { useState } from 'react'
import QuotaBadge from '@/components/quota-badge'
import QuotaModal from '@/components/quota-modal'

export default function ExamplePage() {
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false)

  // 在页面中使用配额显示组件
  return (
    <div>
      {/* 配额显示组件 */}
      <QuotaBadge />

      {/* 配额不足弹窗 */}
      <QuotaModal
        isOpen={isQuotaModalOpen}
        onClose={() => setIsQuotaModalOpen(false)}
      />

      {/* 上传图片前检查配额 */}
      <button
        onClick={async () => {
          // 检查配额
          const res = await fetch('/api/quota')
          const data = await res.json()

          if (data.success && data.data.total === 0) {
            // 配额不足，显示弹窗
            setIsQuotaModalOpen(true)
          } else {
            // 配额充足，上传图片
            // TODO: 上传图片逻辑
          }
        }}
      >
        上传图片
      </button>
    </div>
  )
}
