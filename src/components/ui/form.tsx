"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { Controller, FormProvider, useFormContext } from "react-hook-form"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"

const Form = FormProvider

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue>({} as FormFieldContextValue)

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState, formState } = useFormContext()

  const fieldState = getFieldState(fieldContext.name, formState)

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>")
  }

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

type FormItemContextValue = {
  id: string
}

const FormItemContext = React.createContext<FormItemContextValue>({} as FormItemContextValue)

const FormItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const id = React.useId()

    return (
      <FormItemContext.Provider value={{ id }}>
        <div ref={ref} className={cn("space-y-2", className)} {...props} />
      </FormItemContext.Provider>
    )
  },
)
FormItem.displayName = "FormItem"

const FormLabel = React.forwardRef<React.ElementRef<typeof Label>, React.ComponentPropsWithoutRef<typeof Label>>(
  ({ className, ...props }, ref) => {
    const { error, formItemId } = useFormField()

    return <Label ref={ref} className={cn(error && "text-destructive", className)} htmlFor={formItemId} {...props} />
  },
)
FormLabel.displayName = "FormLabel"

const FormControl = React.forwardRef<React.ElementRef<typeof Slot>, React.ComponentPropsWithoutRef<typeof Slot>>(
  ({ ...props }, ref) => {
    const { error, formItemId, formDescriptionId, formMessageId } = useFormField()

    return (
      <Slot
        ref={ref}
        id={formItemId}
        aria-describedby={!error ? `${formDescriptionId}` : `${formDescriptionId} ${formMessageId}`}
        aria-invalid={!!error}
        {...props}
      />
    )
  },
)
FormControl.displayName = "FormControl"

const FormDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => {
    const { formDescriptionId } = useFormField()

    return (
      <p ref={ref} id={formDescriptionId} className={cn("text-[0.8rem] text-muted-foreground", className)} {...props} />
    )
  },
)
FormDescription.displayName = "FormDescription"

const FormMessage = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children, ...props }, ref) => {
    const { error, formMessageId } = useFormField()
    const body = error ? String(error?.message) : children

    if (!body) {
      return null
    }

    return (
      <p
        ref={ref}
        id={formMessageId}
        className={cn("text-[0.8rem] font-medium text-destructive", className)}
        {...props}
      >
        {body}
      </p>
    )
  },
)
FormMessage.displayName = "FormMessage"

type FieldValues = Record<string, any>
type FieldPath<TFieldValues extends FieldValues> = string
type ControllerProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> = {
  name: TName
  control?: any // Replace with Control<TFieldValues> if you have it
  render: ({ field, fieldState, formState }: { field: any; fieldState: any; formState: any }) => React.ReactElement
}

const FormInput = React.forwardRef<React.ElementRef<typeof Input>, React.ComponentPropsWithoutRef<typeof Input>>(
  ({ ...props }, ref) => {
    const { name } = useFormField()
    return <Input ref={ref} id={name} {...props} />
  },
)
FormInput.displayName = "FormInput"

const FormTextarea = React.forwardRef<
  React.ElementRef<typeof Textarea>,
  React.ComponentPropsWithoutRef<typeof Textarea>
>(({ ...props }, ref) => {
  const { name } = useFormField()
  return <Textarea ref={ref} id={name} {...props} />
})
FormTextarea.displayName = "FormTextarea"

const FormSwitch = React.forwardRef<React.ElementRef<typeof Switch>, React.ComponentPropsWithoutRef<typeof Switch>>(
  ({ ...props }, ref) => {
    const { name } = useFormField()
    return <Switch ref={ref} id={name} {...props} />
  },
)
FormSwitch.displayName = "FormSwitch"

const FormCheckbox = React.forwardRef<
  React.ElementRef<typeof Checkbox>,
  React.ComponentPropsWithoutRef<typeof Checkbox>
>(({ ...props }, ref) => {
  const { name } = useFormField()
  return <Checkbox ref={ref} id={name} {...props} />
})
FormCheckbox.displayName = "FormCheckbox"

const FormRadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroup>,
  React.ComponentPropsWithoutRef<typeof RadioGroup>
>(({ ...props }, ref) => {
  const { name } = useFormField()
  return <RadioGroup ref={ref} id={name} {...props} />
})
FormRadioGroup.displayName = "FormRadioGroup"

const FormSelect = React.forwardRef<React.ElementRef<typeof Select>, React.ComponentPropsWithoutRef<typeof Select>>(
  ({ children, ...props }, ref) => {
    const { name } = useFormField()
    return (
      <Select {...props}>
        <SelectTrigger id={name} ref={ref}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    )
  },
)
FormSelect.displayName = "FormSelect"

const FormSelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectTrigger>,
  React.ComponentPropsWithoutRef<typeof SelectTrigger>
>(({ children, className, ...props }, ref) => {
  const { name } = useFormField()
  return (
    <SelectTrigger ref={ref} id={name} className={className} {...props}>
      {children}
    </SelectTrigger>
  )
})
FormSelectTrigger.displayName = "FormSelectTrigger"

const FormSelectItem = React.forwardRef<
  React.ElementRef<typeof SelectItem>,
  React.ComponentPropsWithoutRef<typeof SelectItem>
>(({ children, className, ...props }, ref) => {
  return (
    <SelectItem ref={ref} className={className} {...props}>
      {children}
    </SelectItem>
  )
})
FormSelectItem.displayName = "FormSelectItem"

export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
  FormInput,
  FormTextarea,
  FormSwitch,
  FormCheckbox,
  FormRadioGroup,
  FormSelect,
  FormSelectTrigger,
  FormSelectItem,
}
