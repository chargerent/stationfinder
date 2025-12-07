import React, { useState, useEffect } from "react";
import {
  MdDirectionsWalk,
  MdDirectionsCar,
  MdLocationOn,
} from "react-icons/md";
import logoImage from "./assets/logo.png";

// --- Configuration ---
const KIOSK_API_ENDPOINT = "/api/public/locations";
const SEARCH_RADIUS_MILES = 25;
const SEARCH_RADIUS_KM = Math.round(SEARCH_RADIUS_MILES * 1.60934);

// --- Bilingual Translations ---
const translations = {
  en: {
    title: "Station locator",
    subtitle: "Find available chargers or return locations",
    countryLabel: "Country",
    postalCodeLabel: "Postal Code",
    searchButton: "Search",
    orSeparator: "or",
    gpsButton: "Use My Current Location",
    placeholders: {
      us: "Enter Zip Code (e.g., 90210)",
      fr: "Enter Postal Code (e.g., 75001)",
      ca: "Enter Postal Code (e.g., A1A 1A1)",
    },
    milesUnit: "miles",
    kmUnit: "km",
    walkingDirections: "Walking Directions",
    drivingDirections: "Driving Directions",
    showDrivingToggleLabel: "Show driving directions",
    availableChargers: "Available Chargers",
    availableSlots: "Empty Slots",
    loadingKiosks: "Loading available kiosks...",
    findingLocation: "Finding locations near you...",
    warning_connectivity:
      "Warning: Limited connectivity. Charger and slot counts might not be accurate.",
    error_loadFailed: "Failed to load kiosk data. Please try again later.",
    error_noKiosksFound: `No kiosks found within ${SEARCH_RADIUS_MILES} miles of your location.`,
    error_noQrKiosksFound: "Could not find the specified kiosks.",
    error_gpsPermission: "GPS permission denied or location unavailable.",
    error_geolocationNotSupported:
      "Geolocation is not supported by your browser.",
    error_invalidPostalCode:
      "The location service could not find this postal code. Please try a different code or use your GPS location.",
    error_postalCodeNotFound:
      "Could not find location data for this postal code.",
    error_searchFailed: "Could not perform search.",
    error_missingApiKey:
      "Location service is not configured. Please use GPS search.",
    initialPrompt: "Please select a search method to find nearby kiosks.",
  },
  fr: {
    title: "Localisateur de Bornes",
    subtitle: "Trouvez des batteries ou des points de restitution disponibles",
    countryLabel: "Pays",
    postalCodeLabel: "Code Postal",
    searchButton: "Rechercher",
    orSeparator: "ou",
    gpsButton: "Utiliser ma position actuelle",
    placeholders: {
      us: "Entrez le code ZIP (ex: 90210)",
      fr: "Entrez le code postal (ex: 75001)",
      ca: "Entrez le code postal (ex: A1A 1A1)",
    },
    milesUnit: "miles",
    kmUnit: "km",
    walkingDirections: "Itinéraire à pied",
    drivingDirections: "Itinéraire en voiture",
    showDrivingToggleLabel: "Afficher l’itinéraire en voiture",
    availableChargers: "Chargeurs disponibles",
    availableSlots: "Emplacements vides",
    loadingKiosks: "Chargement des kiosques disponibles...",
    findingLocation: "Recherche de votre position...",
    warning_connectivity:
      "Avertissement : connectivité limitée. Le nombre de chargeurs et d'emplacements peut ne pas être exact.",
    error_loadFailed:
      "Échec du chargement des données des kiosques. Veuillez réessayer plus tard.",
    error_noKiosksFound: `Aucun kiosque trouvé à moins de ${SEARCH_RADIUS_KM} km de votre emplacement.`,
    error_noQrKiosksFound: "Impossible de trouver les kiosques spécifiés.",
    error_gpsPermission:
      "Permission GPS refusée ou emplacement non disponible.",
    error_geolocationNotSupported:
      "La géolocalisation n'est pas prise en charge par ce navigateur.",
    error_invalidPostalCode:
      "Le service de localisation n'a pas pu trouver ce code postal. Veuillez essayer un autre code ou utiliser votre position GPS.",
    error_postalCodeNotFound:
      "Impossible de trouver les données de localisation pour ce code postal.",
    error_searchFailed: "La recherche n'a pas pu être effectuée.",
    error_missingApiKey:
      "Le service de localisation n'est pas configuré. Veuillez utiliser la recherche GPS.",
    initialPrompt:
      "Veuillez sélectionner une méthode de recherche pour trouver les kiosques à proximité.",
  },
};

// --- Utilities ---
const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3958.8; // miles
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Use Node-RED backend geocode endpoint
const geocodeZipCode = async (country, zipCode, t) => {
  const response = await fetch(
    `/api/geocode?country=${encodeURIComponent(
      country
    )}&postal=${encodeURIComponent(zipCode)}`
  );

  if (!response.ok) {
    throw new Error(t.error_invalidPostalCode);
  }

  const data = await response.json();
  if (
    !data ||
    typeof data.lat !== "number" ||
    typeof data.lon !== "number"
  ) {
    throw new Error(t.error_postalCodeNotFound);
  }

  return { lat: data.lat, lon: data.lon };
};

// --- Components ---
const LoadingSpinner = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-10 text-center">
    <div className="loader border-4 border-gray-200 border-t-blue-500 rounded-full w-10 h-10 animate-spin"></div>
    <p className="mt-3 text-gray-600 font-medium">{message}</p>
  </div>
);

const SearchControls = ({ onSearch, isLoading, t }) => {
  const [country, setCountry] = useState("us");
  const [zipCode, setZipCode] = useState("");

  const handleZipSearchSubmit = (e) => {
    e.preventDefault();
    if (zipCode.trim() && !isLoading) {
      const sanitizedZip = zipCode.trim().replace(/\s/g, "");
      onSearch({ type: "zip", value: sanitizedZip, country });
    }
  };

  const handleGpsSearchClick = () => {
    if (!isLoading) onSearch({ type: "gps" });
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md mb-6 sticky top-4 z-10">
      <form onSubmit={handleZipSearchSubmit}>
        <div className="mb-3">
          <label
            htmlFor="country-select"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {t.countryLabel}
          </label>
          <select
            id="country-select"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full px-3 py-3 border border-gray-300 rounded-md bg-gray-50 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
            disabled={isLoading}
          >
            <option value="us">United States</option>
            <option value="ca">Canada</option>
            <option value="fr">France</option>
          </select>
        </div>
        <div className="mb-3">
          <label
            htmlFor="zipcode-input"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {t.postalCodeLabel}
          </label>
          <div className="flex gap-2">
            <input
              id="zipcode-input"
              type="text"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              placeholder={t.placeholders[country] || "Enter postal code"}
              className="flex-grow px-4 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              disabled={isLoading}
            />
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-md shadow hover:bg-blue-700 disabled:bg-gray-400"
              disabled={isLoading}
            >
              {t.searchButton}
            </button>
          </div>
        </div>
      </form>
      <div className="relative flex items-center my-4">
        <div className="flex-grow border-t border-gray-200" />
        <span className="flex-shrink mx-2 text-gray-400 text-sm">
          {t.orSeparator}
        </span>
        <div className="flex-grow border-t border-gray-200" />
      </div>
      <button
        onClick={handleGpsSearchClick}
        className="w-full px-6 h-12 bg-green-600 text-white font-semibold rounded-md shadow hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2 text-center"
        disabled={isLoading}
      >
        <MdLocationOn className="w-5 h-5" />
        {t.gpsButton}
      </button>
    </div>
  );
};

const LanguageSelector = ({ language, setLanguage }) => {
  const baseClasses =
    "px-3 py-1 text-sm font-semibold rounded-md transition-colors";
  const activeClasses = "bg-blue-600 text-white";
  const inactiveClasses = "bg-gray-200 text-gray-700 hover:bg-gray-300";

  return (
    <div className="absolute top-4 right-4 flex items-center gap-2">
      <button
        onClick={() => setLanguage("en")}
        className={`${baseClasses} ${
          language === "en" ? activeClasses : inactiveClasses
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLanguage("fr")}
        className={`${baseClasses} ${
          language === "fr" ? activeClasses : inactiveClasses
        }`}
      >
        FR
      </button>
    </div>
  );
};

const KioskPanel = ({ kiosk, t, language, showDriving }) => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  const walkingUrl = isIOS
    ? `http://maps.apple.com/?daddr=${kiosk.lat},${kiosk.lon}&dirflg=w`
    : `https://www.google.com/maps/dir/?api=1&destination=${kiosk.lat},${kiosk.lon}&travelmode=walking`;

  const drivingUrl = isIOS
    ? `http://maps.apple.com/?daddr=${kiosk.lat},${kiosk.lon}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${kiosk.lat},${kiosk.lon}&travelmode=driving`;

  const isFrench = language === "fr";
  const distanceValue =
    kiosk.distanceInMiles !== undefined
      ? isFrench
        ? kiosk.distanceInMiles * 1.60934
        : kiosk.distanceInMiles
      : null;
  const unit = isFrench ? t.kmUnit : t.milesUnit;

  const chargerCount = kiosk.hasConnectivityWarning
    ? 0
    : kiosk.availableChargers;
  const chargerColor = kiosk.hasConnectivityWarning
    ? "text-yellow-600"
    : "text-green-600";

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200 transform transition-all hover:shadow-lg">
      <div className="p-4">
        <div className="flex justify-between items-start mb-2 gap-3">
          <h3 className="text-lg font-bold text-gray-800">
            {kiosk.locationName}
          </h3>
          {distanceValue !== null && (
            <span className="flex-shrink-0 text-sm font-medium text-blue-700 bg-blue-100 px-3 py-1 rounded-full whitespace-nowrap">
              {distanceValue.toFixed(1)} {unit}
            </span>
          )}
        </div>
        {kiosk.place && (
          <p className="text-gray-600 text-sm mb-3">{kiosk.place}</p>
        )}
        <p className="text-gray-600 text-sm mb-3">
          {kiosk.address}, {kiosk.zip}
        </p>

        {/* Tiny icon-only buttons, same line */}
        <div className="flex justify-end gap-2 mb-4">
          <a
            href={walkingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white hover:bg-blue-600 shadow"
            aria-label={t.walkingDirections}
          >
            <MdDirectionsWalk className="w-5 h-5" />
          </a>
          {showDriving && (
            <a
              href={drivingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-700 text-white hover:bg-gray-800 shadow"
              aria-label={t.drivingDirections}
            >
              <MdDirectionsCar className="w-5 h-5" />
            </a>
          )}
        </div>

        <div className="border-t border-gray-100 pt-4">
          {kiosk.hasConnectivityWarning && (
            <div
              className="bg-yellow-100 border border-yellow-300 text-yellow-800 px-3 py-2 rounded-md mb-4"
              role="alert"
            >
              <p className="text-sm font-medium text-center">
                {t.warning_connectivity}
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <span className={`block text-2xl font-bold ${chargerColor}`}>
                {chargerCount}
              </span>
              <span className="block text-xs font-medium text-gray-500 uppercase tracking-wide min-h-[2.5em] flex items-center justify-center">
                {t.availableChargers}
              </span>
            </div>
            <div>
              <span className="block text-2xl font-bold text-gray-700">
                {kiosk.availableSlots}
              </span>
              <span className="block text-xs font-medium text-gray-500 uppercase tracking-wide min-h-[2.5em] flex items-center justify-center">
                {t.availableSlots}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [language, setLanguage] = useState("en");
  const t = translations[language];

  const [allKiosks, setAllKiosks] = useState([]);
  const [latestTimestamp, setLatestTimestamp] = useState(null);
  const [filteredKiosks, setFilteredKiosks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isQrSearch, setIsQrSearch] = useState(false);
  const [showDriving, setShowDriving] = useState(true); // toggle for driving directions
  const [drivingParamExists, setDrivingParamExists] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const kioskIdsFromUrl = urlParams.get("kiosks")?.split(",");
    const drivingParam = urlParams.get("driving");

    if (drivingParam !== null) {
      setDrivingParamExists(true);
      setShowDriving(drivingParam !== "0");
    }

    const fetchAllKioskData = async () => {
      try {
        const response = await fetch(KIOSK_API_ENDPOINT);
        if (!response.ok) throw new Error(translations["en"].error_loadFailed);

        let data = await response.json();
        if (typeof data === "string") {
          data = JSON.parse(data);
        }

        const validTimestamps = data
          .map((kiosk) => new Date(kiosk.timestamp).getTime())
          .filter((ts) => !isNaN(ts));

        let now;
        if (validTimestamps.length > 0) {
          const maxTimestamp = Math.max(...validTimestamps);
          now = new Date(maxTimestamp);
        } else {
          console.warn(
            "No valid timestamps found in kiosk data. Falling back to client's local time."
          );
          now = new Date();
        }
        setLatestTimestamp(now);

        // 🔹 10-day filter instead of 30
        const tenDaysAgo = new Date(now);
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
        const recentKiosks = data.filter((kiosk) => {
          if (!kiosk.timestamp) return false;
          return new Date(kiosk.timestamp) > tenDaysAgo;
        });

        setAllKiosks(recentKiosks);

        if (kioskIdsFromUrl && kioskIdsFromUrl.length > 0) {
          setIsQrSearch(true);
          const qrKiosks = recentKiosks.filter((kiosk) =>
            kioskIdsFromUrl.includes(kiosk.id)
          );

          if (qrKiosks.length > 0) {
            const tenMinutesAgo = new Date(
              now.getTime() - 10 * 60 * 1000
            );
            const qrKiosksWithWarning = qrKiosks.map((kiosk) => ({
              ...kiosk,
              hasConnectivityWarning: kiosk.timestamp
                ? new Date(kiosk.timestamp) < tenMinutesAgo
                : true,
            }));
            setFilteredKiosks(qrKiosksWithWarning);
          } else {
            setError(t.error_noQrKiosksFound);
          }
          setHasSearched(true);
        }
      } catch (err) {
        console.error("Fetch error:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllKioskData();
  }, [language, t]);

  const filterKiosksByLocation = (userLat, userLon) => {
    if (!latestTimestamp) return;

    const tenMinutesAgo = new Date(latestTimestamp.getTime() - 10 * 60 * 1000);

    const nearby = allKiosks
      .map((kiosk) => {
        const hasConnectivityWarning = kiosk.timestamp
          ? new Date(kiosk.timestamp) < tenMinutesAgo
          : true;
        return {
          ...kiosk,
          distanceInMiles: calculateHaversineDistance(
            userLat,
            userLon,
            kiosk.lat,
            kiosk.lon
          ),
          hasConnectivityWarning,
        };
      })
      .filter((kiosk) => kiosk.distanceInMiles <= SEARCH_RADIUS_MILES)
      .sort((a, b) => a.distanceInMiles - b.distanceInMiles);

    setFilteredKiosks(nearby);
    setIsLoading(false);
    setHasSearched(true);
  };

  const handleSearch = async (searchOptions) => {
    setIsLoading(true);
    setError(null);
    setFilteredKiosks([]);
    setHasSearched(true);
    try {
      if (searchOptions.type === "gps") {
        if (!navigator.geolocation)
          throw new Error(t.error_geolocationNotSupported);
        navigator.geolocation.getCurrentPosition(
          (position) =>
            filterKiosksByLocation(
              position.coords.latitude,
              position.coords.longitude
            ),
          (geoError) => {
            console.error("Geolocation error:", geoError.message);
            setError(t.error_gpsPermission);
            setIsLoading(false);
          },
          { timeout: 10000 }
        );
      } else if (searchOptions.type === "zip") {
        const { lat, lon } = await geocodeZipCode(
          searchOptions.country,
          searchOptions.value,
          t
        );
        filterKiosksByLocation(lat, lon);
      }
    } catch (err) {
      console.error("Search error:", err);
      setError(err.message || t.error_searchFailed);
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    if (isLoading && !hasSearched)
      return <LoadingSpinner message={t.loadingKiosks} />;
    if (isLoading) return <LoadingSpinner message={t.findingLocation} />;
    if (error)
      return (
        <div className="text-center text-red-600 font-medium bg-red-100 p-4 rounded-md shadow">
          {error}
        </div>
      );
    if (filteredKiosks.length > 0) {
      return (
        <div className="space-y-4">
          {filteredKiosks.map((kiosk) => (
            <KioskPanel
              key={kiosk.id}
              kiosk={kiosk}
              t={t}
              language={language}
              showDriving={showDriving}
            />
          ))}
        </div>
      );
    }
    if (hasSearched && !isQrSearch)
      return (
        <div className="text-center text-gray-600 font-medium bg-white p-6 rounded-lg shadow">
          {t.error_noKiosksFound}
        </div>
      );
    if (hasSearched && isQrSearch)
      return (
        <div className="text-center text-gray-600 font-medium bg-white p-6 rounded-lg shadow">
          {t.error_noQrKiosksFound}
        </div>
      );
    return (
      <div className="text-center text-gray-500 pt-4">{t.initialPrompt}</div>
    );
  };

  return (
    <div className="container mx-auto max-w-2xl p-4 relative">
      <LanguageSelector language={language} setLanguage={setLanguage} />
      <header className="text-center my-6">
        <img
          src={logoImage}
          alt="Station Locator Logo"
          className="w-24 mx-auto mb-4"
        />
        <h1 className="text-3xl font-bold text-gray-900">{t.title}</h1>
        <p className="text-md text-gray-600 mt-1">{t.subtitle}</p>
      </header>

      {/* QR-mode driving toggle */}
      {isQrSearch && !drivingParamExists && (
        <div className="flex justify-center items-center mb-4">
          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              className="rounded border-gray-300"
              checked={showDriving}
              onChange={(e) => setShowDriving(e.target.checked)}
            />
            <span>{t.showDrivingToggleLabel}</span>
          </label>
        </div>
      )}

      <main>
        {!isQrSearch && (
          <SearchControls onSearch={handleSearch} isLoading={isLoading} t={t} />
        )}
        <div className="results-area mt-6">{renderContent()}</div>
      </main>
    </div>
  );
};

export default App;
