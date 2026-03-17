import { useEffect, useState } from "react";
import CruFolioLogo from "./CruFolioLogo";
import { sanitizeTenantLogoUrl } from "../utils/branding";

export default function BrandLogo({
  logo,
  companyName = "CruFolio",
  size = 32,
  variant = "dark",
  className,
  style,
}) {
  const sanitizedLogo = sanitizeTenantLogoUrl(logo);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [sanitizedLogo]);

  if (!sanitizedLogo || imageFailed) {
    return (
      <CruFolioLogo
        size={size}
        variant={variant}
        className={className}
        style={style}
      />
    );
  }

  return (
    <img
      src={sanitizedLogo}
      alt={companyName || "CruFolio"}
      className={className}
      style={style}
      onError={() => setImageFailed(true)}
    />
  );
}
