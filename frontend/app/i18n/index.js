/**
 * Module: app/i18n/index.js
 *
 * Purpose:
 * - Initializes internationalization and language dictionaries.
 *
 * Module notes:
 * - Imports count: 5.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - No local function declarations detected; file is primarily declarative/configuration-based.
 */

import * as Localization from "expo-localization";
import { I18n } from "i18n-js";

import en from "./en.json";
import kg from "./kg.json";
import ru from "./ru.json";

export const SUPPORTED_LANGUAGES = ["ru", "en", "kg"];

const i18n = new I18n({
  ru,
  en,
  kg,
});

i18n.enableFallback = true;
i18n.defaultLocale = "ru";

const systemCode = Localization.getLocales()?.[0]?.languageCode;
i18n.locale = SUPPORTED_LANGUAGES.includes(systemCode) ? systemCode : "ru";

export default i18n;
