import { useId, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { ButtonAlt } from '@/components/ui/button-alt';
import { SelectAltPanelContainer, SelectAltScrollRegion } from '@/components/ui/select-alt';
import globeIcon from '@/assets/icons/globe.svg';
import { useLang } from '@/contexts/LangContext';

/** Locales with `src/locales/*.yaml` bundles (parsed at build time). */
const LANGUAGE_OPTIONS = [
  { value: 'en' as const, label: 'English' },
  { value: 'el' as const, label: 'Ελληνικά' },
] as const;

export function NavbarLanguageGlobe() {
  const { locale, setLocale } = useLang();
  const [panelOpen, setPanelOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const triggerId = `${baseId}-trigger`;

  const currentLabel = LANGUAGE_OPTIONS.find((o) => o.value === locale)?.label ?? locale;

  return (
    <div
      className="relative flex flex-col items-end self-stretch"
      onMouseEnter={() => setPanelOpen(true)}
      onMouseLeave={() => {
        setPanelOpen(false);
        setListOpen(false);
      }}
    >
      <ButtonAlt
        intent="navbarGlobe"
        active={panelOpen}
        aria-expanded={panelOpen}
        aria-controls={panelOpen ? `${baseId}-panel` : undefined}
        aria-haspopup="dialog"
        aria-label="Γλώσσα"
      >
        <img src={globeIcon} alt="" aria-hidden className="size-6" />
      </ButtonAlt>

      {panelOpen ? (
        <div
          id={`${baseId}-panel`}
          className="absolute right-0 top-full z-[60] w-[min(calc(100vw-2rem),13.5rem)] pt-2"
          role="presentation"
        >
          <SelectAltPanelContainer>
            <ButtonAlt
              id={triggerId}
              intent="languageTrigger"
              aria-expanded={listOpen}
              aria-controls={listOpen ? listboxId : undefined}
              aria-haspopup="listbox"
              onClick={() => setListOpen((v) => !v)}
            >
              <span className="min-w-0 truncate">{currentLabel}</span>
              {listOpen ? (
                <ChevronUp className="size-3.5 shrink-0 text-neutral-500" aria-hidden />
              ) : (
                <ChevronDown className="size-3.5 shrink-0 text-neutral-500" aria-hidden />
              )}
            </ButtonAlt>

            {listOpen ? (
              <SelectAltScrollRegion id={listboxId} role="listbox" aria-labelledby={triggerId}>
                {LANGUAGE_OPTIONS.map((opt) => {
                  const selected = opt.value === locale;
                  return (
                    <ButtonAlt
                      key={opt.value}
                      intent="languageOption"
                      active={selected}
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        setLocale(opt.value);
                        setListOpen(false);
                      }}
                    >
                      {opt.label}
                    </ButtonAlt>
                  );
                })}
              </SelectAltScrollRegion>
            ) : null}
          </SelectAltPanelContainer>
        </div>
      ) : null}
    </div>
  );
}
