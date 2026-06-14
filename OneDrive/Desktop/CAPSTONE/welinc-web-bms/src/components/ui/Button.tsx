import * as React from "react"
// Lightweight local replacement for `class-variance-authority` to avoid
// needing the external dependency in this file.
// Generic VariantProps to mirror the shape of cva variant props usage.
type VariantProps = Record<string, any>

function cva(base: string, options?: any) {
  return (props: Record<string, any> = {}) => {
    let cls = base
    const variants = options?.variants || {}
    const defaults = options?.defaultVariants || {}

    for (const key of Object.keys(variants)) {
      const val = props[key] ?? defaults[key]
      if (val && variants[key] && variants[key][val]) {
        cls += ` ${variants[key][val]}`
      }
    }

    if (props.className) cls += ` ${props.className}`
    return cls
  }
}
// Lightweight local replacement for @radix-ui/react-slot to avoid
// needing the external dependency in environments where it's not
// installed. This Slot simply clones its single child and merges
// props onto it, which is sufficient for our use in this file.
const Slot: React.FC<any> = ({ children, ...props }) => {
  if (React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement, props)
  }
  return <>{children}</>
}

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ")
}

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants }