import { useState, useMemo } from "react"
import { Country, City, ICountry, ICity } from "country-state-city"

interface LocationSelectorProps {
    nationality: string
    city: string
    onNationalityChange: (value: string) => void
    onCityChange: (value: string) => void
}

export function LocationSelector({
                                     nationality,
                                     city,
                                     onNationalityChange,
                                     onCityChange,
                                 }: LocationSelectorProps) {
    const countries = Country.getAllCountries()

    const [selectedIso, setSelectedIso] = useState<string>(() => {
        const found = countries.find((c) => c.name === nationality)
        return found?.isoCode ?? ""
    })

    // Recalcule les villes quand selectedIso change — pas de useEffect
    const cities: ICity[] = useMemo(
        () => (selectedIso ? City.getCitiesOfCountry(selectedIso) ?? [] : []),
        [selectedIso]
    )

    // Reset si le parent remet nationality à "" (ex: handleReset)
    const effectiveIso = nationality ? selectedIso : ""

    const handleCountryChange = (isoCode: string) => {
        setSelectedIso(isoCode)
        const countryName = countries.find((c) => c.isoCode === isoCode)?.name ?? ""
        onNationalityChange(countryName)
        onCityChange("")
    }

    const selectClass =
        "h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm " +
        "focus:outline-none focus:bg-white focus:border-indigo-400 transition-colors"

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2">
            <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">Nationalité</label>
                <select
                    value={effectiveIso}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className={selectClass}
                >
                    <option value="">-- Sélectionner un pays --</option>
                    {countries.map((c: ICountry) => (
                        <option key={c.isoCode} value={c.isoCode}>
                            {c.flag} {c.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">Ville actuelle</label>
                <select
                    value={city}
                    onChange={(e) => onCityChange(e.target.value)}
                    disabled={!effectiveIso}
                    className={selectClass + (!effectiveIso ? " opacity-50 cursor-not-allowed" : "")}
                >
                    <option value="">
                        {effectiveIso ? "-- Sélectionner une ville --" : "Choisir d'abord un pays"}
                    </option>
                    {cities.map((c: ICity) => (
                        <option key={`${c.name}-${c.stateCode}`} value={c.name}>
                            {c.name}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    )
}