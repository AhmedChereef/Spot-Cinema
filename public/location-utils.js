function normalizeId(value) {
  return value == null ? "" : String(value);
}

function displayName(item) {
  return item?.nameAr || item?.name || item?.nameEn || "";
}

export function movieLocationOptions(movie, locations = {}) {
  const citiesById = new Map((locations.cities || []).map((city) => [normalizeId(city.id), city]));
  const areasByCity = locations.areasByCity || {};
  const cities = new Map();
  const areas = new Map();

  for (const day of movie?.dates || []) {
    for (const cinema of day.cinemas || []) {
      const cityId = normalizeId(cinema.location?.city?.id);
      if (!cityId) continue;

      const city = citiesById.get(cityId) || cinema.location.city;
      if (!cities.has(cityId)) cities.set(cityId, { id: cityId, name: displayName(city) || "محافظة غير محددة" });

      const areaId = normalizeId(cinema.location?.area?.id);
      if (!areaId) continue;

      if (!areas.has(cityId)) areas.set(cityId, new Map());
      const localizedArea = (areasByCity[cityId] || []).find((item) => normalizeId(item.id) === areaId);
      const area = localizedArea || cinema.location.area;
      if (!areas.get(cityId).has(areaId)) areas.get(cityId).set(areaId, { id: areaId, name: displayName(area) || "منطقة غير محددة" });
    }
  }

  const sortByName = (first, second) => first.name.localeCompare(second.name, "ar");
  return {
    cities: [...cities.values()].sort(sortByName),
    areasByCity: Object.fromEntries([...areas].map(([cityId, items]) => [cityId, [...items.values()].sort(sortByName)])),
  };
}

export function localizedCinemaLocation(cinema, locations = {}) {
  const cityId = normalizeId(cinema?.location?.city?.id);
  const areaId = normalizeId(cinema?.location?.area?.id);
  const city = (locations.cities || []).find((item) => normalizeId(item.id) === cityId) || cinema?.location?.city;
  const area = (locations.areasByCity?.[cityId] || []).find((item) => normalizeId(item.id) === areaId) || cinema?.location?.area;
  return [displayName(area), displayName(city)].filter(Boolean).join("، ") || "الموقع غير مصنف";
}
