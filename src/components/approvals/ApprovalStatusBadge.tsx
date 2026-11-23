/** The system-wide status badge (same look as StatusBadge in StandardTable), with approval colours. */
export default function ApprovalStatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone = ['approved', 'verified', 'refunded', 'confirmed'].includes(normalized)
    ? 'border-[#30c967] bg-[#dcfce7] text-[#22ad4f]'
    : ['pending', 'requested', 'verifying'].includes(normalized)
      ? 'border-[#ff7a00] bg-[#fff3e4] text-[#ff7a00]'
      : ['rejected', 'cancelled', 'withdrawn'].includes(normalized)
        ? 'border-[#ef4444] bg-[#fee2e2] text-[#ef4444]'
        : 'border-[#94a3b8] bg-[#f8fafc] text-[#475569]';
  return <span className={`inline-flex min-w-24 justify-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${tone}`}>{['requested', 'verifying'].includes(normalized) ? 'Pending' : status}</span>;
}
