import { LOADING_CONTENT, type LoadingRoute } from "@/lib/config/loading";
import { Wordmark } from "@/components/shared/wordmark";

export interface SiteLoadingScreenProps {
  route?: LoadingRoute;
  label?: string;
}

export function SiteLoadingScreen({ route = "home", label }: SiteLoadingScreenProps) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="booking-loading-page grid min-h-svh place-items-center overflow-hidden bg-surface-base px-6 text-center text-text-primary sm:px-10"
    >
      <div className="booking-loading-content relative z-10 max-w-4xl">
        <Wordmark variant="primary" height={80} label="WellPlace — Wellness Made Private" className="site-transition-logo" />
        <div aria-hidden="true" className="booking-loading-progress mx-auto mt-10">
          <span className="block h-full origin-left bg-brand" />
        </div>
        <span className="sr-only">{label ?? LOADING_CONTENT.routeLabels[route]}</span>
      </div>
    </div>
  );
}
