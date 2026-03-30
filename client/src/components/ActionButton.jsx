import React from "react";

export function ActionGlyph({ icon = "arrow-right", className = "" }) {
  const sharedProps = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.9",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  switch (icon) {
    case "plus":
      return (
        <svg {...sharedProps}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );
    case "edit":
      return (
        <svg {...sharedProps}>
          <path d="M12 20h9" />
          <path d="m16.5 3.5 4 4L8 20l-4 1 1-4 11.5-13.5Z" />
        </svg>
      );
    case "delete":
      return (
        <svg {...sharedProps}>
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="m6 6 1 14h10l1-14" />
          <path d="M10 10v6" />
          <path d="M14 10v6" />
        </svg>
      );
    case "location":
      return (
        <svg {...sharedProps}>
          <path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" />
          <circle cx="12" cy="10" r="2.6" />
        </svg>
      );
    case "restrict":
      return (
        <svg {...sharedProps}>
          <path d="M5 12a7 7 0 1 0 14 0 7 7 0 0 0-14 0Z" />
          <path d="m7 17 10-10" />
        </svg>
      );
    case "suspend":
      return (
        <svg {...sharedProps}>
          <path d="M12 3 4.5 6v5.4c0 5 3 8 7.5 9.6 4.5-1.6 7.5-4.6 7.5-9.6V6L12 3Z" />
          <path d="M12 8v4.4" />
          <path d="M12 16h.01" />
        </svg>
      );
    case "back":
      return (
        <svg {...sharedProps}>
          <path d="m10 6-6 6 6 6" />
          <path d="M4 12h16" />
        </svg>
      );
    case "restore":
      return (
        <svg {...sharedProps}>
          <path d="M20 12a8 8 0 1 1-2.34-5.66" />
          <path d="M20 4v6h-6" />
        </svg>
      );
    case "eye":
      return (
        <svg {...sharedProps}>
          <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "users":
      return (
        <svg {...sharedProps}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
          <circle cx="9.5" cy="7" r="3.5" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.9" />
          <path d="M16.5 4.2a3.5 3.5 0 0 1 0 5.6" />
        </svg>
      );
    case "close":
      return (
        <svg {...sharedProps}>
          <path d="m18 6-12 12" />
          <path d="m6 6 12 12" />
        </svg>
      );
    case "chart":
      return (
        <svg {...sharedProps}>
          <path d="M4 19h16" />
          <path d="M7 16V9" />
          <path d="M12 16V5" />
          <path d="M17 16v-4" />
        </svg>
      );
    case "check":
      return (
        <svg {...sharedProps}>
          <path d="m5 12 4.2 4.2L19 6.5" />
        </svg>
      );
    case "pickup":
      return (
        <svg
          className={className}
          viewBox="0 0 430 430"
          fill="none"
          stroke="currentColor"
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M270 145h63.469a20 20 0 0 1 17.308 9.979l46.532 80.372A20 20 0 0 1 400 245.372V315h-30m-100 0h35m-165 0h130V85H35v230h40" />
          <circle cx="337.5" cy="315" r="32.5" />
          <circle cx="107.5" cy="315" r="32.5" />
          <path d="M365.263 180H315v60h84.265" />
        </svg>
      );
    case "mail":
      return (
        <svg {...sharedProps}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      );
    case "save":
      return (
        <svg {...sharedProps}>
          <path d="M5 4h11l3 3v13H5z" />
          <path d="M8 4v5h8" />
          <path d="M8 20v-6h8v6" />
        </svg>
      );
    case "password":
      return (
        <svg {...sharedProps}>
          <rect x="4" y="11" width="16" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 1 1 8 0v3" />
          <path d="M12 15v2" />
        </svg>
      );
    case "crosshair":
      return (
        <svg {...sharedProps}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v3" />
          <path d="M12 19v3" />
          <path d="M2 12h3" />
          <path d="M19 12h3" />
        </svg>
      );
    case "map":
      return (
        <svg {...sharedProps}>
          <path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z" />
          <path d="M9 4v14" />
          <path d="M15 6v14" />
        </svg>
      );
    case "search":
      return (
        <svg {...sharedProps}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-4.2-4.2" />
        </svg>
      );
    case "report":
      return (
        <svg {...sharedProps}>
          <path d="M5 21V4" />
          <path d="M5 5h9l-1.6 3L14 11H5" />
        </svg>
      );
    case "download":
      return (
        <svg {...sharedProps}>
          <path d="M12 4v11" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 20h14" />
        </svg>
      );
    case "phone":
      return (
        <svg {...sharedProps}>
          <path d="M6.8 3.5h2.7l1.4 4-1.8 1.8a14 14 0 0 0 5.8 5.8l1.8-1.8 4 1.4v2.7c0 1-.8 1.9-1.8 2-8 .6-15.2-6.6-14.6-14.6.1-1 .9-1.8 2-1.8Z" />
        </svg>
      );
    case "apply":
      return (
        <svg {...sharedProps}>
          <rect x="5" y="4" width="14" height="16" rx="2" />
          <path d="M9 4.5h6" />
          <path d="M9 10h6" />
          <path d="M9 14h4" />
        </svg>
      );
    case "dashboard":
      return (
        <svg {...sharedProps}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="4" rx="1.5" />
          <rect x="14" y="10" width="7" height="11" rx="1.5" />
          <rect x="3" y="13" width="7" height="8" rx="1.5" />
        </svg>
      );
    case "contact":
      return (
        <svg {...sharedProps}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
          <path d="M8 9h8" />
          <path d="M8 13h5" />
        </svg>
      );
    default:
      return (
        <svg {...sharedProps}>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );
  }
}

export default function ActionButton({
  children,
  icon = "arrow-right",
  type = "button",
  tone = "primary",
  size = "md",
  fullWidth = false,
  minWidth,
  width,
  className = "",
  style,
  ...props
}) {
  const hasIcon = icon !== null && icon !== false;
  const iconNode = !hasIcon ? null : React.isValidElement(icon) ? icon : <ActionGlyph icon={icon} />;

  const mergedStyle = {
    ...(minWidth ? { "--action-button-min-width": typeof minWidth === "number" ? `${minWidth}px` : minWidth } : {}),
    ...(width ? { "--action-button-width": typeof width === "number" ? `${width}px` : width } : {}),
    ...style,
  };

  const classNames = [
    "action-button",
    `action-button--${tone}`,
    `action-button--${size}`,
    !hasIcon ? "action-button--no-icon" : "",
    fullWidth ? "action-button--block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button {...props} type={type} className={classNames} style={mergedStyle}>
      <span className="action-button__text">{children}</span>
      {hasIcon && <span className="action-button__icon">{iconNode}</span>}
    </button>
  );
}
