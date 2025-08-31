interface ColorBtnProps {
  size: number // 32 or 45
  color: string // dynamic fill for outer ellipse
  active?: boolean // if you want variant styling
}

export default function ColorBtn({ size, color }: ColorBtnProps) {
  const strokeWidth = 1.5
  const rOuter = size / 2
  const rInner = rOuter - 3 // maintain similar white ring thickness visually
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx={rOuter} cy={rOuter} r={rOuter} fill={color} />
      <circle cx={rOuter} cy={rOuter} r={rInner} fill="none" stroke="#FFFFFF" strokeWidth={strokeWidth} />
    </svg>
  )
}
