import * as React from "react"
import { buttonVariants } from "./Button"

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ")

interface AlertDialogContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const AlertDialogContext = React.createContext<AlertDialogContextValue | null>(null)

interface AlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

const AlertDialog = ({ open, onOpenChange, children }: AlertDialogProps) => (
  <AlertDialogContext.Provider value={{ open, onOpenChange }}>
    {children}
  </AlertDialogContext.Provider>
)

const AlertDialogTrigger = ({ children }: { children: React.ReactNode }) => {
  const ctx = React.useContext(AlertDialogContext)
  return (
    <button
      type="button"
      onClick={() => ctx?.onOpenChange(true)}
      className="inline-flex"
    >
      {children}
    </button>
  )
}

const AlertDialogPortal = ({ children }: { children: React.ReactNode }) => <>{children}</>

const AlertDialogOverlay = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const ctx = React.useContext(AlertDialogContext)
    if (!ctx?.open) return null

    return (
      <div
        ref={ref}
        className={cn("fixed inset-0 z-50 bg-black/80", className)}
        {...props}
      />
    )
  }
)
AlertDialogOverlay.displayName = "AlertDialogOverlay"

const AlertDialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const ctx = React.useContext(AlertDialogContext)
    if (!ctx?.open) return null

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <AlertDialogOverlay className="z-40" />
        <div
          ref={ref}
          className={cn(
            "relative z-50 w-full max-w-lg rounded-xl border bg-white p-6 shadow-2xl dark:bg-slate-900 dark:border-slate-700",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </div>
    )
  }
)
AlertDialogContent.displayName = "AlertDialogContent"

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col space-y-2 text-center sm:text-left", className)}
    {...props}
  />
)
AlertDialogHeader.displayName = "AlertDialogHeader"

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
)
AlertDialogFooter.displayName = "AlertDialogFooter"

const AlertDialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn("text-lg font-semibold", className)} {...props} />
  )
)
AlertDialogTitle.displayName = "AlertDialogTitle"

const AlertDialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm text-slate-600 dark:text-slate-300", className)}
      {...props}
    />
  )
)
AlertDialogDescription.displayName = "AlertDialogDescription"

const AlertDialogAction = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(buttonVariants(), className)}
      {...props}
    />
  )
)
AlertDialogAction.displayName = "AlertDialogAction"

const AlertDialogCancel = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, onClick, ...props }, ref) => {
    const ctx = React.useContext(AlertDialogContext)
    return (
      <button
        ref={ref}
        type="button"
        className={cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", className)}
        onClick={(event) => {
          ctx?.onOpenChange(false)
          onClick?.(event)
        }}
        {...props}
      />
    )
  }
)
AlertDialogCancel.displayName = "AlertDialogCancel"

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}