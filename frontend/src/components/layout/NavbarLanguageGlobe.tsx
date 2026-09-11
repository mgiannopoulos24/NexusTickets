import { useId, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { ButtonAlt } from '@/components/ui/button-alt';
import { SelectAltPanelContainer, SelectAltScrollRegion } from '@/components/ui/select-alt';
import flagGb from '@/assets/icons/flag-gb.svg';
import flagGr from '@/assets/icons/flag-gr.svg';
import globeIcon from '@/assets/icons/globe.svg';
import { useLang } from '@/contexts/langContext';

/** Locales with `src/locales/*.yaml` bundles (parsed at build time). */
const LANGUAGE_OPTIONS = [
  { value: 'el' as const, label: 'Ελληνικά', flag: flagGr },
  { value: 'en' as const, label: 'English', flag: flagGb },
] as const;

function Flag({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      className="mr-2 inline-block h-[14px] w-[21px] shrink-0 rounded-[2px] object-cover ring-1 ring-black/10"
    />
  );
}

export function NavbarLanguageGlobe() {
  const { locale, setLocale, t } = useLang();
  const [panelOpen, setPanelOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const triggerId = `${baseId}-trigger`;

  const current = LANGUAGE_OPTIONS.find((o) => o.value === locale);

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
        aria-label={t('nav.language')}
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
              <span className="flex min-w-0 items-center truncate">
                {current ? <Flag src={current.flag} /> : null}
                {current?.label ?? locale}
              </span>
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
                      <Flag src={opt.flag} />
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
