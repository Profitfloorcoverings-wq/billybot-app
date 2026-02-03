import * as React from "react";

function cn(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type ButtonVariant = "default" | "secondary" | "ghost";
type ButtonSize = "default" | "sm";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, children, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center gap-2 rounded-full border border-transparent font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:opacity-60 disabled:pointer-events-none";
    const variants: Record<ButtonVariant, string> = {
      default: "bg-blue-500 text-slate-950 hover:bg-blue-400",
      secondary: "bg-white/5 text-white border-white/10 hover:bg-white/10",
      ghost: "bg-transparent text-white border-white/10 hover:bg-white/5",
    };
    const sizes: Record<ButtonSize, string> = {
      default: "h-10 px-4 text-sm",
      sm: "h-9 px-3 text-xs",
    };
    const classes = cn(base, variants[variant], sizes[size], className);

    if (asChild) {
      const child = React.Children.only(children);
      if (React.isValidElement(child)) {
        return React.cloneElement(child, {
          className: cn(classes, child.props.className),
        });
      }
      return null;
    }

    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };
