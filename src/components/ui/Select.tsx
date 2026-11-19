import * as React from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "../../lib/utils"

/*
 * Searchable select (combobox).
 *
 * Same API as the Radix-based select it replaces (Select / SelectTrigger / SelectValue / SelectContent / SelectItem),
 * but the field itself is a text box: click it to open the list, or just start typing in it to filter the options.
 */

type ActiveOption = { value: string; id: string } | null

type SelectContextValue = {
  value: string
  select: (value: string) => void
  disabled: boolean
  required: boolean
  open: boolean
  setOpen: (open: boolean) => void
  query: string
  setQuery: (query: string) => void
  labels: Record<string, string>
  registerLabel: (value: string, text: string) => void
  active: ActiveOption
  setActive: (option: ActiveOption) => void
  listId: string
  triggerRef: React.MutableRefObject<HTMLDivElement | null>
  inputRef: React.MutableRefObject<HTMLInputElement | null>
  listRef: React.MutableRefObject<HTMLDivElement | null>
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

function useSelectContext(component: string) {
  const context = React.useContext(SelectContext)
  if (!context) throw new Error(`<${component}> must be used inside <Select>`)
  return context
}

/** "register": the list is closed; items only report their labels so the field can show the selected one. */
const RenderModeContext = React.createContext<"register" | "list">("list")

/** Flattens a React node tree into its visible text so options can be shown in the field and matched against the query. */
function getNodeText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(getNodeText).join("")
  if (React.isValidElement(node)) return getNodeText((node.props as { children?: React.ReactNode }).children)
  return ""
}

const collapseSpaces = (text: string) => text.replace(/\s+/g, " ").trim()

/** Every whitespace-separated term in the query must appear somewhere in the option text (case-insensitive). */
function matchesQuery(text: string, query: string) {
  const terms = collapseSpaces(query.toLowerCase()).split(" ").filter(Boolean)
  if (terms.length === 0) return true
  const haystack = text.toLowerCase()
  return terms.every((term) => haystack.includes(term))
}

const ENABLED_OPTION = '[role="option"]:not([aria-disabled="true"])'

type SelectProps = {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  /** Marks the field as required for assistive technology; validation stays with the page. */
  required?: boolean
  name?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

function Select({ value: valueProp, defaultValue = "", onValueChange, disabled = false, required = false, name: _name, open: openProp, onOpenChange, children }: SelectProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue)
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [labels, setLabels] = React.useState<Record<string, string>>({})
  const [active, setActive] = React.useState<ActiveOption>(null)
  const listId = React.useId()
  const triggerRef = React.useRef<HTMLDivElement | null>(null)
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const listRef = React.useRef<HTMLDivElement | null>(null)

  const value = valueProp ?? uncontrolledValue
  const open = (openProp ?? uncontrolledOpen) && !disabled

  const setOpen = React.useCallback((next: boolean) => {
    if (openProp === undefined) setUncontrolledOpen(next)
    onOpenChange?.(next)
    if (!next) {
      setQuery("")
      setActive(null)
    }
  }, [openProp, onOpenChange])

  const select = React.useCallback((next: string) => {
    if (next !== value) {
      if (valueProp === undefined) setUncontrolledValue(next)
      onValueChange?.(next)
    }
    setOpen(false)
  }, [value, valueProp, onValueChange, setOpen])

  const registerLabel = React.useCallback((itemValue: string, text: string) => {
    setLabels((current) => (current[itemValue] === text ? current : { ...current, [itemValue]: text }))
  }, [])

  const context = React.useMemo<SelectContextValue>(() => ({
    value, select, disabled, required, open, setOpen, query, setQuery, labels, registerLabel, active, setActive, listId, triggerRef, inputRef, listRef,
  }), [value, select, disabled, required, open, setOpen, query, labels, registerLabel, active, listId])

  return <SelectContext.Provider value={context}>{children}</SelectContext.Provider>
}

/** Props given to <SelectTrigger> that belong on the text box (labels, validation state, focus handlers). */
type FieldProps = React.InputHTMLAttributes<HTMLInputElement>
const TriggerFieldContext = React.createContext<FieldProps>({})

const FIELD_PROP = /^(id|name|required|autoFocus|tabIndex|onBlur|onFocus|onKeyDown|aria-.*)$/

const SelectTrigger = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { disabled?: boolean }>(
  ({ className, children, disabled: disabledProp, onMouseDown, ...props }, ref) => {
    const { open, setOpen, disabled: rootDisabled, value, triggerRef, inputRef } = useSelectContext("SelectTrigger")
    const disabled = rootDisabled || Boolean(disabledProp)
    const fieldProps: Record<string, unknown> = {}
    const wrapperProps: Record<string, unknown> = {}
    for (const [key, propValue] of Object.entries(props)) (FIELD_PROP.test(key) ? fieldProps : wrapperProps)[key] = propValue
    const invalid = props["aria-invalid"] === true || props["aria-invalid"] === "true"

    return (
      <div
        ref={(node) => {
          triggerRef.current = node
          if (typeof ref === "function") ref(node)
          else if (ref) ref.current = node
        }}
        data-state={open ? "open" : "closed"}
        data-disabled={disabled ? "" : undefined}
        data-placeholder={value ? undefined : ""}
        className={cn(
          "flex h-11 w-full cursor-pointer items-center justify-between gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus-within:border-[#1a1f6e] focus-within:outline-none focus-within:ring-2 focus-within:ring-[#1a1f6e]/20 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white",
          className,
          invalid && "focus-within:border-red-500 focus-within:ring-red-500/20"
        )}
        onMouseDown={(event) => {
          onMouseDown?.(event)
          if (disabled || event.defaultPrevented || event.button !== 0) return
          const input = inputRef.current
          if (event.target === input) {
            // Clicking into the text box opens the list but leaves the caret where the user put it.
            if (!open) setOpen(true)
            return
          }
          event.preventDefault()
          input?.focus()
          setOpen(!open)
        }}
        {...wrapperProps}
      >
        <TriggerFieldContext.Provider value={{ ...(fieldProps as FieldProps), disabled }}>
          {children}
        </TriggerFieldContext.Provider>
        <ChevronDown className={cn("h-4 w-4 shrink-0 opacity-50 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </div>
    )
  }
)
SelectTrigger.displayName = "SelectTrigger"

/** The text box inside the trigger: shows the selected option, and becomes the search field while the list is open. */
function SelectValue({ placeholder }: { placeholder?: React.ReactNode }) {
  const { value, required, open, setOpen, query, setQuery, labels, active, setActive, select, listId, inputRef, listRef } = useSelectContext("SelectValue")
  const { onKeyDown, onBlur, onFocus, disabled, ...fieldProps } = React.useContext(TriggerFieldContext)
  const selectedText = value ? labels[value] ?? "" : ""
  const placeholderText = typeof placeholder === "string" ? placeholder : getNodeText(placeholder)
  const shownText = open ? query : selectedText

  const enabledOptions = () => Array.from(listRef.current?.querySelectorAll<HTMLElement>(ENABLED_OPTION) ?? [])
  const highlight = (element: HTMLElement | undefined) => {
    if (!element) return
    setActive({ value: element.dataset.value ?? "", id: element.id })
    element.scrollIntoView({ block: "nearest" })
  }

  return (
    <span className="flex min-w-0 flex-1 items-center">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        aria-required={required || undefined}
        aria-activedescendant={open && active ? active.id : undefined}
        autoComplete="off"
        spellCheck={false}
        disabled={Boolean(disabled)}
        size={Math.max(1, (shownText || placeholderText).length)}
        value={shownText}
        // While searching, the current choice stays visible as the hint text.
        placeholder={open && selectedText ? selectedText : placeholderText}
        {...fieldProps}
        className="w-full min-w-0 cursor-[inherit] truncate bg-transparent text-left outline-none placeholder:text-slate-400 focus:cursor-text disabled:cursor-not-allowed"
        onFocus={(event) => {
          // Select the shown option so typing replaces it with a search.
          event.currentTarget.select()
          onFocus?.(event)
        }}
        onBlur={(event) => {
          if (open) setOpen(false)
          onBlur?.(event)
        }}
        onChange={(event) => {
          let next = event.target.value
          // Typing while the list is closed starts a new search rather than editing the shown option.
          if (!open && selectedText && next.startsWith(selectedText)) next = next.slice(selectedText.length)
          setQuery(next)
          if (!open) setOpen(true)
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (event.defaultPrevented) return
          const options = enabledOptions()
          const activeIndex = active ? options.findIndex((option) => option.dataset.value === active.value) : -1
          switch (event.key) {
            case "ArrowDown":
            case "ArrowUp": {
              event.preventDefault()
              if (!open) { setOpen(true); return }
              if (options.length === 0) return
              const step = event.key === "ArrowDown" ? 1 : -1
              const next = activeIndex === -1 ? (step === 1 ? 0 : options.length - 1) : (activeIndex + step + options.length) % options.length
              highlight(options[next])
              return
            }
            case "Home":
            case "End":
              if (!open || options.length === 0) return
              event.preventDefault()
              highlight(event.key === "Home" ? options[0] : options[options.length - 1])
              return
            case "Enter": {
              event.preventDefault()
              if (!open) { setOpen(true); return }
              const choice = options[activeIndex] ?? options[0]
              if (choice) select(choice.dataset.value ?? "")
              return
            }
            case " ":
              if (!open) { event.preventDefault(); setOpen(true) }
              return
            case "Tab":
              if (open) setOpen(false)
              return
          }
        }}
      />
    </span>
  )
}

type SelectContentProps = React.HTMLAttributes<HTMLDivElement> & {
  position?: "popper" | "item-aligned"
  align?: "start" | "center" | "end"
  side?: "top" | "bottom"
  sideOffset?: number
  emptyMessage?: React.ReactNode
  /** Kept for compatibility with earlier callers; the search now happens in the field itself. */
  searchPlaceholder?: string
  searchable?: boolean
}

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className, children, align = "start", side, sideOffset = 4, emptyMessage = "No results found", position: _position, searchPlaceholder: _searchPlaceholder, searchable: _searchable, style, ...props }, ref) => {
    const { open, setOpen, query, value, active, setActive, listId, triggerRef, listRef } = useSelectContext("SelectContent")
    const [coords, setCoords] = React.useState<React.CSSProperties | null>(null)
    const [hasOptions, setHasOptions] = React.useState(true)

    // Place the list under the field (or above it when there is more room there) and keep it attached while scrolling.
    React.useLayoutEffect(() => {
      if (!open) {
        setCoords(null)
        return
      }
      const place = () => {
        const trigger = triggerRef.current
        if (!trigger) return
        const rect = trigger.getBoundingClientRect()
        const spaceBelow = window.innerHeight - rect.bottom - sideOffset - 8
        const spaceAbove = rect.top - sideOffset - 8
        const placeAbove = side === "top" || (side !== "bottom" && spaceBelow < 240 && spaceAbove > spaceBelow)
        const next: React.CSSProperties = {
          position: "fixed",
          minWidth: rect.width,
          maxHeight: Math.max(120, Math.min(384, placeAbove ? spaceAbove : spaceBelow)),
          pointerEvents: "auto",
        }
        if (placeAbove) next.bottom = window.innerHeight - rect.top + sideOffset
        else next.top = rect.bottom + sideOffset
        if (align === "end") next.right = window.innerWidth - rect.right
        else if (align === "center") { next.left = rect.left + rect.width / 2; next.transform = "translateX(-50%)" }
        else next.left = rect.left
        setCoords(next)
      }
      place()
      window.addEventListener("resize", place)
      window.addEventListener("scroll", place, true)
      return () => {
        window.removeEventListener("resize", place)
        window.removeEventListener("scroll", place, true)
      }
    }, [open, align, side, sideOffset, triggerRef])

    // Highlight the current choice when the list opens, and the first match while the user is typing.
    React.useLayoutEffect(() => {
      if (!open) return
      const list = listRef.current
      const options = Array.from(list?.querySelectorAll<HTMLElement>(ENABLED_OPTION) ?? [])
      setHasOptions(Boolean(list?.querySelector('[role="option"]')))
      const target = query.trim() ? options[0] : options.find((option) => option.dataset.value === value) ?? options[0]
      if (target) {
        setActive({ value: target.dataset.value ?? "", id: target.id })
        target.scrollIntoView({ block: "nearest" })
      } else if (active) {
        setActive(null)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, query, children, coords === null])

    // Escape closes just this list. Listening on window in the capture phase runs before Radix dialogs
    // (which listen on document) so the surrounding dialog stays open.
    React.useEffect(() => {
      if (!open) return
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Escape") return
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
      }
      window.addEventListener("keydown", onKeyDown, true)
      return () => window.removeEventListener("keydown", onKeyDown, true)
    }, [open, setOpen])

    // Inside a modal dialog the page blocks wheel scrolling outside the dialog; scroll the list by hand in that case.
    React.useEffect(() => {
      if (!open) return
      const onWheel = (event: WheelEvent) => {
        const list = listRef.current
        if (event.defaultPrevented && list && event.target instanceof Node && list.contains(event.target)) list.scrollTop += event.deltaY
      }
      window.addEventListener("wheel", onWheel)
      return () => window.removeEventListener("wheel", onWheel)
    }, [open, listRef])

    if (!open) {
      return <RenderModeContext.Provider value="register">{children}</RenderModeContext.Provider>
    }

    return createPortal(
      <div
        ref={(node) => {
          listRef.current = node
          if (typeof ref === "function") ref(node)
          else if (ref) ref.current = node
        }}
        id={listId}
        role="listbox"
        data-select-content=""
        data-state="open"
        // Keep focus in the field while the user clicks or scrolls the list.
        onMouseDown={(event) => event.preventDefault()}
        className={cn(
          "z-[100] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-white p-1 text-slate-800 shadow-xl dark:border-gray-700 dark:bg-gray-900 dark:text-white",
          className
        )}
        style={{ ...style, ...(coords ?? { position: "fixed", visibility: "hidden" }) }}
        {...props}
      >
        <RenderModeContext.Provider value="list">{children}</RenderModeContext.Provider>
        {!hasOptions && query.trim() && (
          <div role="status" className="px-3 py-6 text-center text-sm text-slate-500 dark:text-gray-400">
            {emptyMessage}
          </div>
        )}
      </div>,
      document.body
    )
  }
)
SelectContent.displayName = "SelectContent"

type SelectItemProps = Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> & {
  value: string
  disabled?: boolean
  textValue?: string
  /** Extra words the search should match (e.g. "730pm 19:30" for 7:30 PM). Not displayed. */
  keywords?: string
}

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ className, children, value, disabled = false, textValue, keywords, ...props }, ref) => {
    const { value: selectedValue, select, query, active, setActive, registerLabel } = useSelectContext("SelectItem")
    const mode = React.useContext(RenderModeContext)
    const id = React.useId()
    const text = collapseSpaces(textValue ?? getNodeText(children))

    React.useLayoutEffect(() => {
      registerLabel(value, text)
    }, [registerLabel, value, text])

    if (mode === "register" || !matchesQuery(keywords ? `${text} ${keywords}` : text, query)) return null

    const selected = value === selectedValue
    const highlighted = active?.value === value
    return (
      <div
        ref={ref}
        id={id}
        role="option"
        aria-selected={selected}
        aria-disabled={disabled || undefined}
        data-value={value}
        data-state={selected ? "checked" : "unchecked"}
        data-disabled={disabled ? "" : undefined}
        data-highlighted={highlighted ? "" : undefined}
        onMouseMove={() => { if (!disabled && !highlighted) setActive({ value, id }) }}
        onClick={() => { if (!disabled) select(value) }}
        className={cn(
          "relative flex w-full cursor-pointer select-none items-center rounded-lg py-2 pl-8 pr-3 text-sm outline-none transition-colors data-[highlighted]:bg-[#e8b800] data-[highlighted]:text-[#1a1f6e] data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          className
        )}
        {...props}
      >
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          {selected && <Check className="h-4 w-4" />}
        </span>
        {children}
      </div>
    )
  }
)
SelectItem.displayName = "SelectItem"

const SelectGroup = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div role="group" className={className} {...props} />

const SelectLabel = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  const mode = React.useContext(RenderModeContext)
  if (mode === "register") return null
  return <div className={cn("px-3 py-1.5 text-xs font-semibold text-slate-500", className)} {...props} />
}

const SelectSeparator = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  const mode = React.useContext(RenderModeContext)
  if (mode === "register") return null
  return <div role="separator" className={cn("-mx-1 my-1 h-px bg-slate-100", className)} {...props} />
}

const SelectItemText = ({ children }: { children?: React.ReactNode }) => <>{children}</>

/** The list scrolls natively now; these stay exported so existing imports keep working. */
const SelectScrollUpButton = (_props: React.HTMLAttributes<HTMLDivElement>) => null
const SelectScrollDownButton = (_props: React.HTMLAttributes<HTMLDivElement>) => null

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
  SelectItemText,
}
