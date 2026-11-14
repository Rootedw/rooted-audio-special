"use client";

import { retryListeningRequest } from "../lib/listening-retry";
import { nextPlaybackTrack, setPlaybackSource, ignorePlaybackPause } from "../lib/playback-transition";
import { readPurchaseIntent } from "../lib/purchase-intent";
import { readCheckoutJourney } from "../lib/checkout-journey";
import { trustedCheckoutUrl } from "../lib/checkout-url";
import { DEEPENING_UPGRADE_AMOUNT } from "../lib/products";
import type { PurchasePrices } from "../lib/account-pricing";
import { accountStorageKey } from "../lib/browser-storage";
import { readDraft, makeDraft, resolveStoredValue, acknowledgeDraft } from "../lib/stored-draft";

import {
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Download,
  Headphones,
  Heart,
  Bookmark,
  Home,
  Languages,
  Library,
  LockKeyhole,
  Moon,
  Pause,
  PenLine,
  Play,
  Printer,
  RotateCcw,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Sparkles,
  Timer,
  UserRound,
  Volume2,
} from "lucide-react";


function configurePlaybackSession() {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  try { if (session) session.type = "playback"; } catch { /* Optional browser API. */ }
}

function playNativeAudio(audio: HTMLAudioElement) {
  configurePlaybackSession();
  // Call play inside the tap / native media action, before React schedules work.
  return audio.play().catch((error: unknown) => {
    // A source change may abort an earlier pending play without denying the next.
    if (error instanceof DOMException && error.name === "AbortError") return;
    throw error;
  });
}

function syncNativeMediaState(audio: HTMLAudioElement) {
  if (!("mediaSession" in navigator)) return;
  const session = navigator.mediaSession;
  try { session.playbackState = audio.paused ? "paused" : "playing"; } catch { /* Optional browser API. */ }
  if (!session.setPositionState || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
  try {
    session.setPositionState({
      duration: audio.duration,
      playbackRate: audio.playbackRate || 1,
      position: Math.max(0, Math.min(audio.currentTime, audio.duration)),
    });
  } catch { /* Some browsers support media buttons without position state. */ }
}

function installNativeMediaActions(handlers: Partial<Record<MediaSessionAction, MediaSessionActionHandler>>) {
  if (!("mediaSession" in navigator)) return () => {};
  const installed: MediaSessionAction[] = [];
  for (const action of Object.keys(handlers) as MediaSessionAction[]) {
    if (!handlers[action]) continue;
    try {
      navigator.mediaSession.setActionHandler(action, handlers[action]!);
      installed.push(action);
    } catch { /* One unsupported action must not disable the other buttons. */ }
  }
  return () => {
    for (const action of installed) {
      try { navigator.mediaSession.setActionHandler(action, null); } catch { /* Optional browser API. */ }
    }
  };
}

type Lang = "nl" | "en";
type View = "library" | "blueprint" | "space" | "profile" | "workbook";
type AccountInfo = {
  userId: string;
  email: string;
  products: string[];
  devices: Array<{ id: string; label: string; createdAt: string; lastSeenAt: string }>;
  deviceLimit: number;
  concurrentStreams: number;
  checkoutAvailable?: boolean;
  purchasePrices?: PurchasePrices;
};
type Track = {
  id: string;
  no: string;
  title: string;
  subtitle: string;
  type: "foreword" | "chapter" | "bonus";
  art?: string;
  audio?: string;
  durationSeconds?: number;
};
type PlaybackEntry = {
  position: number;
  duration: number;
  completed: boolean;
  lastPlayed: string;
};
type PlaybackMap = Record<string, PlaybackEntry>;
type SavedMoment = { id: string; trackId: string; position: number; createdAt: string };
function deviceLabel() {
  if (typeof navigator === "undefined") return "Personal device";
  const platform = navigator.platform || "Device";
  const browser = /Android/i.test(navigator.userAgent)
    ? "Android"
    : /iPhone|iPad/i.test(navigator.userAgent)
      ? "Apple mobile"
      : /Chrome/i.test(navigator.userAgent)
        ? "Chrome"
        : "Browser";
  return `${browser} · ${platform}`.slice(0, 60);
}
function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

const chapterRows: [string, string, string][] = [
  [
    "01",
    "SOME PEOPLE DON’T ENTER YOUR LIFE. THEY AWAKEN IT.",
    "Waarom één verbinding iets in jou kan aanraken waar niemand eerder bij kon.",
  ],
  [
    "02",
    "YOU THOUGHT IT WAS ABOUT THEM. UNTIL YOU REALIZED IT WAS REVEALING YOU.",
    "Wanneer je ontdekt dat de verbinding niet alleen over de ander ging, maar jou iets over jezelf kwam laten zien.",
  ],
  [
    "03",
    "THEY DIDN’T CREATE THE WOUND. THEY FOUND IT.",
    "Waarom deze persoon iets in jou raakte dat al bestond voordat jullie elkaar ontmoetten.",
  ],
  [
    "04",
    "WHY DID LOSING THEM FEEL LIKE LOSING YOURSELF?",
    "Wanneer liefde, hechting en jezelf verliezen langzaam met elkaar verweven raken.",
  ],
  [
    "05",
    "YOU WEREN’T CHASING THEM. YOU WERE CHASING THE FEELING OF BEING CHOSEN.",
    "Over de diepere behoefte achter wachten, reiken, hopen en steeds opnieuw bevestiging zoeken.",
  ],
  [
    "06",
    "THE LOVE WAS REAL. SO WAS THE WOUND IT TOUCHED.",
    "Omdat de liefde echt kan zijn én tegelijkertijd een oude pijn kan aanraken.",
  ],
  [
    "07",
    "THE PATTERN DIDN’T START WITH THEM.",
    "Terug naar waar jouw blauwdruk rondom liefde, veiligheid en verbinding ooit werd gevormd.",
  ],
  [
    "08",
    "WHAT IF THEY WERE THE MIRROR, NOT THE MISSING PIECE?",
    "Wat er verandert wanneer je stopt met zoeken naar wat zij jou moeten geven en begint te kijken naar wat zij in jou weerspiegelden.",
  ],
  [
    "09",
    "YOU CAN LOVE THEM AND STILL STOP ABANDONING YOURSELF.",
    "Hoe je van iemand kunt houden zonder jezelf daarvoor opnieuw achter te laten.",
  ],
  [
    "10",
    "THE AWAKENING WAS NEVER AN INVITATION TO CHASE.",
    "Stop met buiten jezelf najagen wat deze verbinding juist binnenin jou heeft wakker gemaakt.",
  ],
  [
    "11",
    "YOU CANNOT BUILD A NEW LIFE WITH AN OLD BLUEPRINT.",
    "Herschrijf wat je hebt geleerd over liefde, veiligheid, eigenwaarde en gekozen worden.",
  ],
  [
    "12",
    "EVERY LOVE OPENED A DOOR.",
    "Hoe iedere liefde een ander deel van mij opende — en iedere deur mij uiteindelijk terugbracht naar mezelf.",
  ],
  [
    "13",
    "GO. THE BLUEPRINT ENDS WITH YOU.",
    "Je werd niet wakker geschud om dezelfde versie van jezelf te blijven.",
  ],
];
const chapters: Track[] = chapterRows.map(([no, title, subtitle]) => ({
  id: `chapter-${no}`,
  no,
  title,
  subtitle,
  type: "chapter",
  durationSeconds: {
    "01": 634, "02": 519, "03": 447, "04": 436, "05": 525,
    "06": 447, "07": 523, "08": 398, "09": 386, "10": 424,
    "11": 403, "12": 1798, "13": 459,
  }[no],
  art: `/assets/chapter-cards/GO_BLUEPRINT_Chapter_${no}.webp`,
  audio:
    no === "01"
      ? "/api/audio/chapter-01"
      : no === "02"
        ? "/api/audio/chapter-02"
        : no === "03"
          ? "/api/audio/chapter-03"
          : no === "04"
            ? "/api/audio/chapter-04"
            : no === "05"
              ? "/api/audio/chapter-05"
              : no === "06"
                ? "/api/audio/chapter-06"
                : no === "07"
                  ? "/api/audio/chapter-07"
                  : no === "08"
                    ? "/api/audio/chapter-08"
                    : no === "09"
                      ? "/api/audio/chapter-09"
                      : no === "10"
                        ? "/api/audio/chapter-10"
                        : no === "11"
                          ? "/api/audio/chapter-11"
                          : no === "12"
                            ? "/api/audio/chapter-12"
                            : no === "13"
                              ? "/api/audio/chapter-13"
                              : undefined,
}));
const chapterSubtitlesEn = [
  "Why one connection can touch something in you that no one reached before.",
  "When you discover that the connection was not only about them, but came to reveal something about you.",
  "Why this person touched something in you that already existed before you met.",
  "When love, attachment and losing yourself slowly become intertwined.",
  "The deeper need beneath waiting, reaching, hoping and searching for reassurance.",
  "Because the love can be real and still touch an old wound at the same time.",
  "Return to where your blueprint for love, safety and connection was first formed.",
  "What changes when you stop searching for what they should give you and begin seeing what they reflected in you.",
  "How to love someone without abandoning yourself again.",
  "Stop chasing outside yourself what this connection awakened within you.",
  "Rewrite what you learned about love, safety, self-worth and being chosen.",
  "How every love opened a different part of me—and every door ultimately led me back to myself.",
  "You were not awakened to remain the same version of yourself.",
];
const bonusRows: [string, string, string][] = [
  [
    "01",
    "STOP WAITING FOR THEM TO BECOME YOUR CLOSURE.",
    "Neem jezelf terug uit het antwoord, de excuses, het gesprek of de terugkeer waarop je nog steeds wacht.",
  ],
  [
    "02",
    "REWRITE THE LOVE YOU LEARNED.",
    "Doorbreek wat jou heeft geleerd liefde te verwarren met najagen, wachten, jezelf bewijzen en jezelf verliezen.",
  ],
  [
    "03",
    "BECOME WHO THE AWAKENING CAME FOR.",
    "Stop met vragen wat deze verbinding betekent en word de versie van jezelf die erdoor werd wakker gemaakt.",
  ],
];
const bonuses: Track[] = bonusRows.map(([no, title, subtitle]) => ({
  id: `bonus-${no}`,
  no,
  title,
  subtitle,
  type: "bonus",
  durationSeconds: { "01": 270, "02": 308, "03": 309 }[no],
  art: `/assets/chapter-cards/GO_BLUEPRINT_Bonus_${no}.webp`,
  audio: `/api/audio/bonus-${no}`,
}));
const bonusSubtitlesEn = [
  "Take yourself back from the answer, apology, conversation or return you are still waiting for.",
  "Break the pattern that taught you to confuse love with chasing, waiting, proving yourself and losing yourself.",
  "Stop asking what this connection means and become the version of you it came to awaken.",
];
const forewordTrack: Track = {
  id: "foreword", no: "", title: "VOORWOORD",
  subtitle: "Open de deur naar GO BLUEPRINT.", type: "foreword",
  art: "/assets/chapter-cards/GO_BLUEPRINT_Voorwoord.webp",
  audio: "/api/audio/foreword", durationSeconds: 519,
};

function localizeTrack(track: Track, language: Lang): Track {
  if (track.type === "chapter") {
    const index = chapters.findIndex((item) => item.id === track.id);
    return index >= 0
      ? { ...chapters[index], subtitle: language === "nl" ? chapters[index].subtitle : chapterSubtitlesEn[index] }
      : track;
  }
  if (track.type === "bonus") {
    const index = bonuses.findIndex((item) => item.id === track.id);
    return index >= 0
      ? { ...bonuses[index], subtitle: language === "nl" ? bonuses[index].subtitle : bonusSubtitlesEn[index] }
      : track;
  }
  return {
    ...track,
    title: language === "nl" ? "VOORWOORD" : "FOREWORD",
    subtitle: language === "nl" ? "Open de deur naar GO BLUEPRINT." : "Open the door to GO BLUEPRINT.",
  };
}
const workbookQuestions: [string, string, string, string][] = [
  [
    "01",
    chapters[0].title,
    "Wat werd er in mij wakker door deze ontmoeting?",
    "Waar heb ik die levenskracht daarna buiten mezelf geplaatst?",
  ],
  [
    "02",
    chapters[1].title,
    "Wat probeerde ik voortdurend over hen te begrijpen?",
    "Wat vertelt mijn reactie eigenlijk over mijn eigen behoefte, angst of verlangen?",
  ],
  [
    "03",
    chapters[2].title,
    "Wat raakte deze persoon precies in mij?",
    "Wanneer kende ik dit gevoel al, nog vóór deze verbinding?",
  ],
  [
    "04",
    chapters[3].title,
    "Welke delen van mezelf raakten verweven met deze liefde?",
    "Wat stopte ik te voelen, doen of kiezen toen ik bang werd hen kwijt te raken?",
  ],
  [
    "05",
    chapters[4].title,
    "Wat hoopte hun keuze eindelijk over mij te bewijzen?",
    "Hoe gedraag ik mij wanneer ik bang ben niet gekozen te worden?",
  ],
  [
    "06",
    chapters[5].title,
    "Welke liefde was werkelijk aanwezig?",
    "Welke oude pijn werd tegelijk geactiveerd?",
  ],
  [
    "07",
    chapters[6].title,
    "Welke ongeschreven regel over liefde volg ik al jaren?",
    "Van wie of waar heb ik geleerd dat liefde zo werkt?",
  ],
  [
    "08",
    chapters[7].title,
    "Welke kwaliteit zag ik in hen die ik zelf verlang?",
    "Waar leeft die kwaliteit al in mij, misschien nog klein of onbenut?",
  ],
  [
    "09",
    chapters[8].title,
    "Waar zeg ik ja terwijl iets in mij nee voelt?",
    "Wat kost mijn liefde mij wanneer ik mezelf daarbij verlaat?",
  ],
  [
    "10",
    chapters[9].title,
    "Waar gaat mijn energie heen wanneer ik onzeker word?",
    "Wat wil diezelfde energie creëren, beschermen of voeden in mijn eigen leven?",
  ],
  [
    "11",
    chapters[10].title,
    "Welke oude overtuiging bouwt nog steeds mee aan mijn keuzes?",
    "Hoe ziet liefde eruit wanneer veiligheid, eigenwaarde en duidelijkheid mee mogen ontwerpen?",
  ],
  [
    "12",
    chapters[11].title,
    "Welke deur opende iedere belangrijke liefde in mijn leven?",
    "Welke les, grens, kwaliteit of waarheid neem ik mee zonder de persoon opnieuw toegang te geven?",
  ],
  [
    "13",
    chapters[12].title,
    "Wat hoeft na mij niet langer door te gaan?",
    "Wat wil door mij heen leven wanneer ik niet meer op toestemming wacht?",
  ],
];
const workbookQuestionsEn: [string, string, string, string][] = [
  [
    "01",
    chapters[0].title,
    "What awakened in me through this meeting?",
    "Where did I place that life force outside myself afterwards?",
  ],
  [
    "02",
    chapters[1].title,
    "What was I constantly trying to understand about them?",
    "What does my reaction reveal about my own need, fear or desire?",
  ],
  [
    "03",
    chapters[2].title,
    "What exactly did this person touch in me?",
    "When did I know this feeling before this connection?",
  ],
  [
    "04",
    chapters[3].title,
    "Which parts of myself became intertwined with this love?",
    "What did I stop feeling, doing or choosing when I became afraid of losing them?",
  ],
  [
    "05",
    chapters[4].title,
    "What did I hope their choice would finally prove about me?",
    "How do I behave when I am afraid I will not be chosen?",
  ],
  [
    "06",
    chapters[5].title,
    "What love was truly present?",
    "What old pain was activated at the same time?",
  ],
  [
    "07",
    chapters[6].title,
    "What unwritten rule about love have I followed for years?",
    "Who or what taught me that love works this way?",
  ],
  [
    "08",
    chapters[7].title,
    "What quality did I see in them that I desire?",
    "Where does that quality already live in me, even if it is still small or unused?",
  ],
  [
    "09",
    chapters[8].title,
    "Where do I say yes while something in me feels no?",
    "What does my love cost me when I abandon myself?",
  ],
  [
    "10",
    chapters[9].title,
    "Where does my energy go when I feel uncertain?",
    "What does that same energy want to create, protect or nourish in my own life?",
  ],
  [
    "11",
    chapters[10].title,
    "What old belief is still shaping my choices?",
    "What does love look like when safety, self-worth and clarity are allowed to help design it?",
  ],
  [
    "12",
    chapters[11].title,
    "What door did each important love open in my life?",
    "What lesson, boundary, quality or truth can I keep without giving the person access again?",
  ],
  [
    "13",
    chapters[12].title,
    "What no longer has to continue through me?",
    "What wants to live through me when I stop waiting for permission?",
  ],
];
const copy = {
  nl: {
    library: "Mijn Bibliotheek",
    space: "Mijn Plek",
    profile: "Profiel",
    welcome: "Welkom terug",
    continue: "Verder luisteren",
    journey: "Jouw reis",
    begin: "Beginnen",
    play: "Afspelen",
    reflection: "Reflectie",
    favorites: "Favorieten",
    progress: "Mijn voortgang",
    settings: "Instellingen",
    saved: "Alle wijzigingen opgeslagen",
    private: "Jouw Workbook is privé.",
    audioMissing: "Audiomaster nog niet gekoppeld",
    allChapters: "13 hoofdstukken",
    download: "Download mijn Workbook",
    print: "Download printversie",
    collection: "Een privécollectie.",
    chaptersLead:
      "Niet als lessen. Als momenten waarop je terug mag keren naar wat waar is.",
    openWorkbook: "Workbook openen",
    continueWriting: "Verder schrijven",
    firstName: "Voornaam",
    languageLabel: "Taal",
    owned: "Producten in bezit",
    security: "Beveiliging",
    privateAccess: "Privétoegang",
    logout: "Uitloggen",
  },
  en: {
    library: "My Library",
    space: "My Space",
    profile: "Profile",
    welcome: "Welcome back",
    continue: "Continue listening",
    journey: "Your journey",
    begin: "Begin",
    play: "Play",
    reflection: "Reflection",
    favorites: "Favorites",
    progress: "My progress",
    settings: "Settings",
    saved: "All changes saved",
    private: "Your Workbook is private.",
    audioMissing: "Audio master not connected yet",
    allChapters: "13 chapters",
    download: "Download my Workbook",
    print: "Download print version",
    collection: "A private collection.",
    chaptersLead: "Not as lessons. As moments to return to what is true.",
    openWorkbook: "Open Workbook",
    continueWriting: "Continue writing",
    firstName: "First name",
    languageLabel: "Language",
    owned: "Owned products",
    security: "Security",
    privateAccess: "Private access",
    logout: "Log out",
  },
};

let storageAccountPromise: Promise<string> | null = null;
function loadStorageAccount() {
  storageAccountPromise ??= fetch("/api/me", { cache: "no-store" })
    .then(async response => {
      if (!response.ok) throw new Error("Account unavailable");
      const account = await response.json() as { userId?: string };
      if (!account.userId) throw new Error("Account unavailable");
      return account.userId;
    }).catch(error => { storageAccountPromise = null; throw error; });
  return storageAccountPromise;
}

let cloudStatePromise: Promise<Record<string, unknown>> | null = null;
function loadCloudState() {
  cloudStatePromise ??= fetch("/api/state", { cache: "no-store" })
    .then((response) => response.ok ? response.json() : Promise.reject())
    .then((payload: unknown) => (payload as { state?: Record<string, unknown> }).state || {})
    .finally(() => { cloudStatePromise = null; });
  return cloudStatePromise;
}

function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  const localKey = useRef<string | null>(null);
  const pendingEdit = useRef<{ value: T } | null>(null);
  const editRevision = useRef(0);
  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const initialize = async () => {
      const revision = editRevision.current;
      try {
        const userId = await loadStorageAccount();
        if (!active) return;
        localKey.current = accountStorageKey(userId, key);
        let draft = null;
        try { draft = readDraft<T>(localStorage.getItem(localKey.current)); } catch {}
        let cloud: Record<string, unknown> = {};
        let cloudAvailable = true;
        try { cloud = await loadCloudState(); } catch { cloudAvailable = false; }
        if (!active) return;
        if (pendingEdit.current) {
          setValue(pendingEdit.current.value);
          try { localStorage.setItem(localKey.current, makeDraft(pendingEdit.current.value, true)); } catch {}
        } else if (editRevision.current === revision && revision === 0 && (draft || cloudAvailable)) {
          setValue(resolveStoredValue(draft, cloud, key, initial));
        }
        // Only verified cloud data or an explicit local edit may be uploaded.
        if (cloudAvailable || draft?.pending || pendingEdit.current) setHydrated(true);
        if (!cloudAvailable) retryTimer = setTimeout(() => void initialize(), 2000);
      } catch {
        // Retry identity/storage failures without uploading unseen defaults.
        if (active) retryTimer = setTimeout(() => void initialize(), 2000);
      }
    };
    queueMicrotask(() => void initialize());
    window.addEventListener("online", initialize);
    return () => { active = false; clearTimeout(retryTimer); window.removeEventListener("online", initialize); };
  }, [key]);
  useEffect(() => {
    if (!hydrated || !localKey.current) return;
    const storageKey = localKey.current;
    try { localStorage.setItem(storageKey, makeDraft(value, true)); } catch {}
    const status = (state: "saving" | "saved" | "error") =>
      window.dispatchEvent(new CustomEvent("ra-save-status", { detail: { key, status: state } }));
    status("saving");
    const controller = new AbortController();
    const save = async () => {
      if (controller.signal.aborted) return;
      status("saving");
      try {
        const response = await fetch("/api/state", {
          method: "PUT", headers: { "content-type": "application/json" },
          body: JSON.stringify({ key, value }), signal: controller.signal,
        });
        if (!response.ok) throw new Error("save failed");
        if (controller.signal.aborted) return;
        try {
          const acknowledged = acknowledgeDraft(localStorage.getItem(storageKey), value);
          if (acknowledged !== null) {
            localStorage.setItem(storageKey, acknowledged);
            if (pendingEdit.current && JSON.stringify(pendingEdit.current.value) === JSON.stringify(value)) pendingEdit.current = null;
          }
        } catch {}
        status("saved");
      } catch {
        if (!controller.signal.aborted) status("error");
      }
    };
    const timer = window.setTimeout(() => void save(), 450);
    const retry = () => void save();
    window.addEventListener("online", retry);
    return () => {
      controller.abort(); window.clearTimeout(timer);
      window.removeEventListener("online", retry);
    };
  }, [key, value, hydrated]);
  const setStoredValue = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    setValue((current) => {
      const next = typeof action === "function" ? (action as (previous: T) => T)(current) : action;
      editRevision.current += 1;
      pendingEdit.current = { value: next };
      if (localKey.current) {
        try { localStorage.setItem(localKey.current, makeDraft(next, true)); } catch {}
      }
      return next;
    });
    // A user edit is intentional. Keep it queued even when the initial read failed.
    if (localKey.current) setHydrated(true);
  }, []);
  return [value, setStoredValue, hydrated] as const;
}

export default function RootedAudio() {
  const [language, setLanguage, languageReady] = useStored<Lang>("ra-language", "nl");
  const [name, setName, nameReady] = useStored("ra-name", "");
  const [onboarded, setOnboarded, onboardedReady] = useStored("ra-onboarded", false);
  const [introSeen, setIntroSeen, introSeenReady] = useStored("ra-intro-seen", false);
  const [view, setView] = useState<View>("library");
  const [active, setActive, activeReady] = useStored<Track | null>("ra-active-track", null);
  const [favorites, setFavorites] = useStored<string[]>("ra-favorites", []);
  const [reflections, setReflections] = useStored<Record<string, string>>(
    "ra-reflections",
    {},
  );
  const [reflectionTimes, setReflectionTimes] = useStored<Record<string, number>>(
    "ra-reflection-times", {},
  );
  const [playback, setPlayback, playbackReady] = useStored<PlaybackMap>("ra-playback", {});
  const [savedMoments, setSavedMoments] = useStored<SavedMoment[]>("ra-saved-moments", []);
  const [answers, setAnswers] = useStored<Record<string, string>>(
    "ra-workbook",
    {},
  );
  const [workbookSection, setWorkbookSection] = useStored("ra-workbook-section", 0);
  const [playerActivated, setPlayerActivated] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [ritualSeen, setRitualSeen, ritualSeenReady] = useStored("ra-listening-ritual", false);
  const [ritualTrack, setRitualTrack] = useState<Track | null>(null);
  const [languageChosen, setLanguageChosen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [restartStatus, setRestartStatus] = useState<"idle" | "working" | "error">("idle");
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const checkoutLock = useRef(false);
  const [checkoutProduct, setCheckoutProduct] = useState<"go-blueprint-audiobook" | "go-blueprint-deepening" | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponQuote, setCouponQuote] = useState<{ code: string; amount: string } | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const couponRevision = useRef(0);
  const checkoutDialog = useRef<HTMLDialogElement>(null);
  const restoredJourney = useRef(false);
  const returningCheckout = useRef(false);
  const purchaseIntentHandled = useRef(false);
  const [journeyRestored, setJourneyRestored] = useState(false);
  const restoreScroll = useRef<number | null>(null);
  const [paymentReturn, setPaymentReturn] = useState<"idle" | "checking" | "pending" | "failed">("idle");
  const t = copy[language];
  const localizedActive = active ? localizeTrack(active, language) : null;
  const favoriteTracks = useMemo(
    () => [forewordTrack, ...chapters, ...bonuses]
      .filter((x) => favorites.includes(x.id))
      .map((track) => localizeTrack(track, language)),
    [favorites, language],
  );
  const visited = new Set(
    Object.keys(answers)
      .filter((k) => /^\d{2}-/.test(k) && answers[k]?.trim())
      .map((k) => k.slice(0, 2)),
  ).size;
  const answerCount = Object.values(answers).filter((value) => value?.trim()).length;
  const completedCount = chapters.filter((chapter) => playback[chapter.id]?.completed).length;
  const hasDeepening = false;
  const hasAudiobook = Boolean(account?.products.some((product) =>
    product === "rooted-audio-special"));
  const purchasePrices = account?.purchasePrices ?? { audiobook: "17.99", deepening: "24.95", upgrade: DEEPENING_UPGRADE_AMOUNT, privateTest: false };
  const refreshAccount = useCallback(() => fetch("/api/me", { cache: "no-store" })
    .then((response) => response.ok ? response.json() as Promise<AccountInfo> : null)
    .then((data) => { if (data) setAccount(data); })
    .catch(() => {}), []);
  useEffect(() => { void refreshAccount(); }, [refreshAccount]);
  useEffect(() => { returningCheckout.current = new URLSearchParams(window.location.search).get("payment") === "return"; }, []);
  const listenerReady = languageReady && nameReady && onboardedReady && introSeenReady && activeReady && playbackReady && ritualSeenReady;
  const baseCheckoutAmount = checkoutProduct === "go-blueprint-audiobook" ? purchasePrices.audiobook : hasAudiobook ? purchasePrices.upgrade : purchasePrices.deepening;
  const currentCoupon = couponInput.trim().toUpperCase();
  const validCoupon = couponQuote?.code === currentCoupon ? couponQuote : null;
  const checkoutAmount = validCoupon?.amount || baseCheckoutAmount;
  function couponMessage(code?: string) {
    if (code === "COUPON_EXPIRED") return language === "nl" ? "Deze kortingscode is verlopen." : "This discount code has expired.";
    if (code === "COUPON_INVALID") return language === "nl" ? "Deze kortingscode is niet geldig. Controleer de code." : "This discount code is not valid. Please check it.";
    return language === "nl" ? "De korting kon niet worden gecontroleerd. Probeer opnieuw." : "The discount could not be checked. Please try again.";
  }
  async function startCheckout(_productId: "go-blueprint-audiobook" | "go-blueprint-deepening") {
    if (!checkoutLock.current) window.location.assign("/shop");
  }
  useEffect(() => {
    if (checkoutProduct && checkoutDialog.current && !checkoutDialog.current.open) checkoutDialog.current.showModal();
  }, [checkoutProduct]);
  function closeCheckout() {
    if (checkoutBusy) return;
    couponRevision.current += 1; setCouponBusy(false);
    checkoutDialog.current?.close(); setCheckoutProduct(null); setCheckoutError("");
  }
  async function checkCouponFor(productId: "go-blueprint-audiobook" | "go-blueprint-deepening", code: string) {
    const revision = ++couponRevision.current;
    setCouponBusy(true); setCheckoutError(""); setCouponQuote(null);
    const response = await fetch("/api/payments/create", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId, couponCode: code, quoteOnly: true }),
    }).catch(() => null);
    const data = response ? await response.json().catch(() => null) as { amount?: string; couponCode?: string; error?: string } | null : null;
    if (revision !== couponRevision.current) return;
    setCouponBusy(false);
    if (response?.ok && data?.couponCode && /^\d+\.\d{2}$/.test(data.amount || "")) setCouponQuote({ code: data.couponCode, amount: data.amount! });
    else setCheckoutError(couponMessage(data?.error));
  }
  async function checkCoupon() {
    if (!checkoutProduct || couponBusy) return;
    await checkCouponFor(checkoutProduct, currentCoupon);
  }
  useEffect(() => {
    if (purchaseIntentHandled.current || !account || !listenerReady) return;
    const intent = readPurchaseIntent(window.location.pathname + window.location.search);
    if (!intent) return;
    purchaseIntentHandled.current = true;
    setLanguage(intent.lang);
    window.history.replaceState({}, "", window.location.pathname);
    if (account.products.includes("go-blueprint-deepening") || account.products.includes(intent.productId)) {
      setView("blueprint"); return;
    }
    window.location.assign("/shop");
  }, [account, listenerReady]);
  async function submitCheckout() {
    const productId = checkoutProduct;
    if (!productId || checkoutLock.current || couponBusy) return;
    if (currentCoupon && !validCoupon) {
      setCheckoutError(language === "nl" ? "Pas je kortingscode eerst toe of maak het veld leeg." : "Apply your discount code first, or clear the field."); return;
    }
    if (checkoutLock.current) return;
    checkoutLock.current = true;
    setCheckoutBusy(true);
    setCheckoutError("");
    const response = await fetch("/api/payments/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId, expectedAmount: checkoutAmount, couponCode: validCoupon?.code || "" }),
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => null) as { checkoutUrl?: string; paymentId?: string; error?: string } | null : null;
    const target = trustedCheckoutUrl(payload?.checkoutUrl);
    let checkoutHost = "";
    try { checkoutHost = new URL(payload?.checkoutUrl || "").hostname; } catch { /* No URL value is logged. */ }
    if (!response?.ok || !target) {
      // Diagnostics contain only our error code/status, never credentials,
      // customer details, provider response bodies or checkout URLs.
      console.warn("ROOTED_CHECKOUT", JSON.stringify({ code: payload?.error || (response ? `HTTP_${response.status}` : "NETWORK_UNAVAILABLE"), checkoutHost, hasCheckout: typeof payload?.checkoutUrl === "string", responseType: response?.headers.get("content-type") }));
      checkoutLock.current = false;
      setCheckoutBusy(false);
      if (payload?.error === "PRICE_CHANGED") {
        void refreshAccount();
        setCheckoutError(language === "nl" ? "De prijs is veranderd. Controleer het nieuwe bedrag voordat je opnieuw kiest." : "The price has changed. Review the updated amount before choosing again.");
      } else if (payload?.error?.startsWith("COUPON_")) {
        setCouponQuote(null); setCheckoutError(couponMessage(payload.error));
      } else {
        setCheckoutError(language === "nl" ? "De beveiligde betaling kon niet worden gestart. Probeer het later opnieuw." : "The secure payment could not be started. Please try again later.");
      }
      return;
    }
    if (account?.userId && payload?.paymentId) {
      try { sessionStorage.setItem(accountStorageKey(account.userId, "ra-checkout-payment"), payload.paymentId); } catch { /* Return can still use the most recent order. */ }
    }
    if (account?.userId && hasAudiobook) {
      const audio = document.querySelector("audio");
      audio?.pause();
      try {
        sessionStorage.setItem(accountStorageKey(account.userId, "ra-checkout-journey"), JSON.stringify({ view, scroll: window.scrollY, player: playerActivated || Boolean(active), savedAt: Date.now() }));
        if (audio && active && Number.isFinite(audio.duration) && Number.isFinite(audio.currentTime)) {
          const next = { ...playback, [active.id]: { position: audio.currentTime, duration: audio.duration, completed: playback[active.id]?.completed || false, lastPlayed: new Date().toISOString() } };
          localStorage.setItem(accountStorageKey(account.userId, "ra-playback"), makeDraft(next, true));
          setPlayback(next);
          void fetch("/api/state", { method: "PUT", keepalive: true, headers: { "content-type": "application/json" }, body: JSON.stringify({ key: "ra-playback", value: next }) }).catch(() => {});
        }
      } catch { /* Existing account-scoped playback drafts remain available. */ }
    }
    // Keep an ordinary link visible if automatic navigation is interrupted.
    setCheckoutUrl(target.href);
    try { window.location.assign(target.href); } catch { /* Continue using the visible payment link. */ }
  }
  const checkoutNotice = (checkoutBusy || checkoutError) ? (
    <div className="checkout-feedback" aria-live="polite">
      {checkoutError ? <p className="checkout-error" role="alert">{checkoutError}</p> : checkoutUrl ? <>
        <p>{language === "nl" ? "Je veilige betaling staat klaar. Ga verder als de betaalpagina niet vanzelf opent." : "Your secure payment is ready. Continue if the payment page does not open automatically."}</p>
        <a className="btn" href={checkoutUrl}>{language === "nl" ? "DOORGAAN NAAR BETALING" : "CONTINUE TO PAYMENT"}</a>
      </> : <p role="status">{language === "nl" ? "Je veilige betaling wordt voorbereid…" : "Preparing your secure payment…"}</p>}
    </div>
  ) : null;
  const checkoutPanel = checkoutProduct ? (
    <dialog ref={checkoutDialog} onCancel={(event) => { event.preventDefault(); closeCheckout(); }} style={{ margin: "auto", background: "#081b15", color: "#f1eadc", border: "1px solid #a88a50", borderRadius: 16, padding: 28, width: "min(92vw, 460px)", maxHeight: "90dvh", overflowY: "auto" }} aria-labelledby="checkout-title">
      <h2 id="checkout-title">{checkoutProduct === "go-blueprint-audiobook" ? "GO BLUEPRINT · Audiobook" : hasAudiobook ? (language === "nl" ? "Upgrade · Deepening Bundle" : "Upgrade · Deepening Bundle") : "GO BLUEPRINT · Deepening Bundle"}</h2>
      {hasAudiobook && <p>{language === "nl" ? "Je account, luisterpositie, favorieten en antwoorden blijven behouden." : "Your account, listening position, favourites and answers stay with you."}</p>}
      <label htmlFor="checkout-coupon">{language === "nl" ? "Kortingscode (optioneel)" : "Discount code (optional)"}</label>
      <input id="checkout-coupon" autoComplete="off" autoCapitalize="characters" maxLength={80} disabled={checkoutBusy} value={couponInput} onChange={(event) => { couponRevision.current += 1; setCouponBusy(false); setCouponInput(event.target.value); setCouponQuote(null); setCheckoutError(""); }} style={{ display: "block", width: "100%", margin: "10px 0", padding: 12, border: "1px solid #a88a50", background: "#102b21", color: "#fff" }} />
      <button className="btn ghost" disabled={checkoutBusy || couponBusy || !currentCoupon} onClick={() => void checkCoupon()}>{couponBusy ? (language === "nl" ? "CONTROLEREN…" : "CHECKING…") : (language === "nl" ? "CODE TOEPASSEN" : "APPLY CODE")}</button>
      <p aria-live="polite">{validCoupon && <span>{language === "nl" ? "15% korting toegepast. " : "15% discount applied. "}</span>}{language === "nl" ? "Totaal: " : "Total: "}<strong>€{language === "nl" ? checkoutAmount.replace(".", ",") : checkoutAmount}</strong></p>
      {checkoutNotice}
      <button className="btn" disabled={checkoutBusy || couponBusy} onClick={() => void submitCheckout()}>{language === "nl" ? "VERDER NAAR BETALEN" : "CONTINUE TO PAYMENT"}</button>
      <button className="btn ghost" disabled={checkoutBusy} onClick={closeCheckout}>{language === "nl" ? "TERUG" : "BACK"}</button>
    </dialog>
  ) : null;
  useEffect(() => {
    if (restoredJourney.current || !account?.userId || !listenerReady || !hasAudiobook) return;
    restoredJourney.current = true;
    if (!returningCheckout.current) return;
    try {
      const key = accountStorageKey(account.userId, "ra-checkout-journey");
      const journey = readCheckoutJourney(sessionStorage.getItem(key));
      sessionStorage.removeItem(key);
      if (!journey) return;
      restoreScroll.current = journey.scroll;
      setView(journey.view === "workbook" && !hasDeepening ? "blueprint" : journey.view);
      setPlayerActivated(journey.player);
      setJourneyRestored(true);
    } catch { /* Resume from the saved account preferences. */ }
  }, [account?.userId, listenerReady, hasAudiobook, hasDeepening]);
  const checkReturnedPayment = useCallback(async () => {
    let paymentId: string | null = null;
    if (account?.userId) { try { paymentId = sessionStorage.getItem(accountStorageKey(account.userId, "ra-checkout-payment")); } catch {} }
    const response = await fetch("/api/payments/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paymentId }),
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => null) as { status?: string; access?: boolean } | null : null;
    if (!response?.ok || !payload) return "retry" as const;
    if (payload.access) {
      await refreshAccount();
      if (listenerReady) window.history.replaceState({}, "", window.location.pathname);
      setPaymentReturn("idle");
      return "paid" as const;
    }
    if (["canceled", "expired", "failed"].includes(payload.status || "")) {
      setPaymentReturn("failed");
      return "failed" as const;
    }
    return "retry" as const;
  }, [refreshAccount, account?.userId, listenerReady]);
  useEffect(() => {
    if (!account?.userId) return;
    if (new URLSearchParams(window.location.search).get("payment") !== "return") return;
    let active = true;
    let timer = 0;
    let attempts = 0;
    setPaymentReturn("checking");
    const poll = async () => {
      const result = await checkReturnedPayment();
      if (!active || result !== "retry") return;
      attempts += 1;
      if (attempts >= 8) {
        setPaymentReturn("pending");
        return;
      }
      timer = window.setTimeout(() => void poll(), 2000);
    };
    void poll();
    return () => { active = false; window.clearTimeout(timer); };
  }, [checkReturnedPayment, account?.userId]);
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("startover") !== "1") return;
    // The URL triggers an intentional one-time reset state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRestartStatus("working");
    const resetValues: Record<string, unknown> = {
      "ra-name": "",
      "ra-onboarded": false,
      "ra-intro-seen": false,
      "ra-listening-ritual": false,
      "ra-active-track": null,
    };
    Promise.all(
      Object.entries(resetValues).map(async ([key, value]) => {
        const response = await fetch("/api/state", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key, value }),
        });
        if (!response.ok) throw new Error("reset failed");
        const userId = await loadStorageAccount();
        localStorage.setItem(accountStorageKey(userId, key), makeDraft(value, false));
      }),
    )
      .then(() => window.location.replace(window.location.pathname))
      .catch(() => setRestartStatus("error"));
  }, []);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: restoreScroll.current ?? 0, left: 0, behavior: "auto" });
      restoreScroll.current = null;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [view, listenerReady, journeyRestored]);
  function selectPlayerTrack(next: SetStateAction<Track | null>) {
    // Keep an explicitly selected queue/next track mounted, including completed
    // tracks and tracks without a saved position after restoring the player.
    setPlayerActivated(true);
    setActive(next);
  }
  function enterBlueprint() {
    setView("blueprint");
    if (!introSeen) {
      setShowIntro(true);
      setIntroSeen(true);
    }
    window.scrollTo(0, 0);
  }
  function openTrack(track: Track) {
    if (!ritualSeen) {
      setRitualTrack(track);
      return;
    }
    setPlayerActivated(true);
    setActive(track);
    setView("blueprint");
    window.scrollTo(0, 0);
  }
  function nav(v: View) {
    setView(v);
    window.scrollTo(0, 0);
  }
  function toggleFavorite(id: string) {
    setFavorites((x) =>
      x.includes(id) ? x.filter((i) => i !== id) : [...x, id],
    );
  }
  function saveMoment(trackId: string, position: number) {
    const roundedPosition = Math.max(0, Math.round(position));
    const id = `${trackId}-${roundedPosition}-${Date.now()}`;
    setSavedMoments((items) => {
      const alreadySaved = items.some(
        (item) => item.trackId === trackId && Math.abs(item.position - roundedPosition) <= 3,
      );
      return alreadySaved
        ? items
        : [...items, { id, trackId, position: roundedPosition, createdAt: new Date().toISOString() }];
    });
    if (navigator.vibrate) navigator.vibrate(18);
  }

  if (restartStatus !== "idle")
    return (
      <main className="app onboarding">
        <div className="onboarding-glow" />
        <section className="onboarding-card" aria-live="polite">
          <img className="onboarding-logo" src="/assets/rooted-within-logo.png" alt="Rooted Within" />
          <div className="kicker">ROOTED AUDIO</div>
          <h1>
            {restartStatus === "working" ? (
              language === "nl"
                ? <>JE EERSTE<br /><em>BINNENKOMST WORDT VOORBEREID</em></>
                : <>PREPARING YOUR<br /><em>FIRST ENTRY</em></>
            ) : (
              language === "nl"
                ? <>OPNIEUW BEGINNEN<br /><em>LUKT NOG NIET</em></>
                : <>WE COULDN’T<br /><em>RESTART YET</em></>
            )}
          </h1>
          {restartStatus === "error" && (
            <button className="btn enter-btn" onClick={() => window.location.reload()}>
              {language === "nl" ? "PROBEER OPNIEUW" : "TRY AGAIN"}
            </button>
          )}
        </section>
      </main>
    );

  if (!account || !listenerReady) return <main className="app onboarding"><section className="onboarding-card"><p role="status">{language === "nl" ? "Je luisterplek wordt geladen…" : "Loading your listening space…"}</p><button className="btn ghost" onClick={() => window.location.reload()}>{language === "nl" ? "OPNIEUW LADEN" : "RELOAD"}</button></section></main>;

  if (account && !hasAudiobook)
    return (
      <main className="app onboarding">
        <div className="onboarding-glow" />
        <section className="onboarding-card">
          <img className="onboarding-logo" src="/assets/rooted-within-logo.png" alt="Rooted Within" />
          <div className="kicker">ROOTED AUDIO · {language === "nl" ? "PRIVÉTOEGANG" : "PRIVATE ACCESS"}</div>
          <h1>{language === "nl" ? <>TOEGANG NOG<br /><em>NIET ACTIEF</em></> : <>ACCESS NOT<br /><em>ACTIVE YET</em></>}</h1>
          <p className="onboarding-copy">{language === "nl" ? "Voor dit account is nog geen GO BLUEPRINT-product geactiveerd." : "No GO BLUEPRINT product has been activated for this account yet."}</p>
          {paymentReturn === "checking" && <p className="onboarding-copy" role="status">{language === "nl" ? "Je betaling wordt veilig gecontroleerd. Sluit dit scherm niet." : "Your payment is being securely verified. Please keep this screen open."}</p>}
          {paymentReturn === "pending" && <div role="status"><p className="onboarding-copy">{language === "nl" ? "Je betaling wordt nog verwerkt. Er wordt geen tweede betaling gestart." : "Your payment is still processing. A second payment will not be started."}</p><button className="btn ghost" onClick={() => { setPaymentReturn("checking"); void checkReturnedPayment().then((result) => { if (result === "retry") setPaymentReturn("pending"); }); }}>{language === "nl" ? "CONTROLEER OPNIEUW" : "CHECK AGAIN"}</button></div>}
          {paymentReturn === "failed" && <p className="checkout-error" role="alert">{language === "nl" ? "De betaling is niet voltooid. Er is geen toegang geactiveerd." : "The payment was not completed. No access has been activated."}</p>}
          {account.checkoutAvailable && (paymentReturn === "idle" || paymentReturn === "failed") && <div className="choice">
            <a className="btn" href="/shop">ROOTED AUDIO SPECIAL · €24,05</a>
          </div>}
          {checkoutPanel}
          <a className="btn enter-btn" href={`/auth/signout?lang=${language}`}>{language === "nl" ? "UITLOGGEN" : "SIGN OUT"}</a>
        </section>
      </main>
    );

  if (!onboarded)
    return (
      <main className="app onboarding">
        <div className="onboarding-glow" />
        <section className="onboarding-card">
          <img
            className="onboarding-logo"
            src="/assets/rooted-within-logo.png"
            alt="Rooted Within"
          />
          <div className="kicker">
            {languageChosen && language === "nl"
              ? "EEN PRIVÉ LUISTERERVARING"
              : "A PRIVATE LISTENING EXPERIENCE"}
          </div>
          {!languageChosen ? (
            <>
              <p className="onboarding-step">01 / 02</p>
              <h1>
                CHOOSE YOUR
                <br />
                <em>LANGUAGE</em>
              </h1>
              <p className="onboarding-copy">
                Choose the language in which you want to enter ROOTED AUDIO.
              </p>
              <div className="choice">
                <button
                  className="btn"
                  onClick={() => {
                    setLanguage("nl");
                    setLanguageChosen(true);
                  }}
                >
                  Nederlands <ChevronRight size={15} />
                </button>
                <button
                  className="btn ghost"
                  onClick={() => {
                    setLanguage("en");
                    setLanguageChosen(true);
                  }}
                >
                  English <ChevronRight size={15} />
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="onboarding-step">02 / 02</p>
              <h1>
                {language === "nl" ? (
                  <>
                    WAT IS
                    <br />
                    <em>JOUW NAAM?</em>
                  </>
                ) : (
                  <>
                    WHAT IS
                    <br />
                    <em>YOUR NAME?</em>
                  </>
                )}
              </h1>
              <p className="onboarding-copy">
                {language === "nl"
                  ? "Jouw naam maakt deze luisteromgeving persoonlijk."
                  : "Your name makes this listening space personal."}
              </p>
              <input
                aria-label={language === "nl" ? "Voornaam" : "First name"}
                className="input name-input"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                autoFocus
                placeholder={
                  language === "nl" ? "Jouw voornaam" : "Your first name"
                }
              />
              <button
                className="btn enter-btn"
                disabled={!nameDraft.trim()}
                onClick={() => {
                  setName(nameDraft.trim());
                  setOnboarded(true);
                }}
              >
                {language === "nl"
                  ? "Betreed ROOTED AUDIO"
                  : "Enter ROOTED AUDIO"}{" "}
                <ChevronRight size={15} />
              </button>
            </>
          )}
        </section>
      </main>
    );

  if (view === "workbook" && hasDeepening)
    return (
      <div className="app">
        <WorkbookView language={language} t={t} nav={nav} answers={answers}
          setAnswers={setAnswers} visited={visited} section={workbookSection}
          setSection={setWorkbookSection} />
        {active && (playerActivated || (playback[active.id]?.position > 1 && !playback[active.id]?.completed)) && <MiniPlayer language={language} active={active} setActive={selectPlayerTrack}
          reflection={reflections[active.id] || ""}
          setReflection={(value, position) => {
            setReflections({ ...reflections, [active.id]: value });
            if (position != null) setReflectionTimes({ ...reflectionTimes, [active.id]: position });
          }}
          playback={playback} setPlayback={setPlayback} favorites={favorites}
          toggleFavorite={toggleFavorite} onSaveMoment={saveMoment} hasDeepening={hasDeepening} onPlaybackStart={() => setPlayerActivated(true)} />}
      </div>
    );

  return (
    <div className="app">
      <div className="shell">
        <Header view={view} nav={nav} t={t} />
        {checkoutPanel}
        {view === "library" && (
          <LibraryView
            name={name}
            language={language}
            t={t}
            enterBlueprint={enterBlueprint}
            active={localizedActive}
            playback={playback}
            openTrack={openTrack}
          />
        )}{" "}
        {view === "blueprint" && (
          <BlueprintView
            language={language}
            t={t}
            active={localizedActive}
            openTrack={openTrack}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
            setView={setView}
            playback={playback}
            completedCount={completedCount}
            hasDeepening={hasDeepening}
            hasAudiobook={hasAudiobook}
            checkoutAvailable={Boolean(account?.checkoutAvailable)}
            purchasePrices={purchasePrices}
            checkoutBusy={checkoutBusy}
            startCheckout={startCheckout}
          />
        )}{" "}
        {view === "space" && (
          <SpaceView
            t={t}
            active={localizedActive}
            favorites={favoriteTracks}
            reflections={reflections}
            setReflections={setReflections}
            openTrack={openTrack}
            answerCount={answerCount}
            setView={setView}
            playback={playback}
            setPlayback={setPlayback}
            savedMoments={savedMoments}
            reflectionTimes={reflectionTimes}
            hasDeepening={hasDeepening}
          />
        )}{" "}
        {view === "profile" && (
          <ProfileView
            name={name}
            setName={setName}
            language={language}
            setLanguage={setLanguage}
            t={t}
            replayIntro={() => setShowIntro(true)}
            account={account}
            refreshAccount={refreshAccount}
          />
        )}
      </div>
      {active && (playerActivated || (playback[active.id]?.position > 1 && !playback[active.id]?.completed)) && (
        <MiniPlayer
          language={language}
          active={active}
          setActive={selectPlayerTrack}
          reflection={reflections[active.id] || ""}
          setReflection={(value, position) => {
            setReflections({ ...reflections, [active.id]: value });
            if (position != null) setReflectionTimes({ ...reflectionTimes, [active.id]: position });
          }}
          playback={playback}
          setPlayback={setPlayback}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
          onSaveMoment={saveMoment}
          onPlaybackStart={() => setPlayerActivated(true)}
          hasDeepening={hasDeepening}
        />
      )}{" "}
      {showIntro && <Cinematic language={language} close={() => setShowIntro(false)} />}
      {ritualTrack && (
        <ListeningRitual
          language={language}
          track={ritualTrack}
          close={() => setRitualTrack(null)}
          enter={() => {
            setRitualSeen(true);
            setPlayerActivated(true);
            setActive(ritualTrack);
            setView("blueprint");
            setRitualTrack(null);
            window.scrollTo(0, 0);
          }}
        />
      )}
    </div>
  );
}

function Header({
  view,
  nav,
  t,
}: {
  view: View;
  nav: (v: View) => void;
  t: Record<string, string>;
}) {
  const nl = t.space === "Mijn Plek";
  return (
    <header className="topbar">
      <button className="brand" onClick={() => nav("library")}>
        <img src="/assets/rooted-within-logo.png" alt="" />
        <span>
          ROOTED AUDIO SPECIAL<small>BY ROOTED WITHIN</small>
        </span>
      </button>
      <nav className="nav" aria-label={nl ? "Hoofdnavigatie" : "Main navigation"}>
        <a href="/journal">Journaling Workbook</a>
        <button
          className={view === "library" ? "active" : ""}
          onClick={() => nav("library")}
        >
          <Library size={18} />
          <span>{t.library}</span>
        </button>
        <button
          className={view === "space" ? "active" : ""}
          onClick={() => nav("space")}
        >
          <Home size={18} />
          <span>{t.space}</span>
        </button>
        <button
          className={view === "profile" ? "active" : ""}
          onClick={() => nav("profile")}
        >
          <UserRound size={18} />
          <span>{t.profile}</span>
        </button>
      </nav>
    </header>
  );
}
function LibraryView({
  name,
  language,
  t,
  enterBlueprint,
  active,
  playback,
  openTrack,
}: {
  name: string;
  language: Lang;
  t: Record<string, string>;
  enterBlueprint: () => void;
  active: Track | null;
  playback: PlaybackMap;
  openTrack: (track: Track) => void;
}) {
  const nl = language === "nl";
  const activeProgress = active ? playback[active.id] : undefined;
  const canContinue = Boolean(
    active &&
      (activeProgress?.position ?? 0) > 1 &&
      !activeProgress?.completed,
  );
  const hasListeningHistory = Object.values(playback).some(
    (entry) => entry.position > 1 || entry.completed,
  );
  return (
    <main>
      <section className="hero">
        <div className="cover-wrap">
          <img
            className="cover"
            src="/assets/go-blueprint-cover.jpeg"
            alt="Official GO BLUEPRINT Audiobook cover"
          />
        </div>
        <div className="hero-copy">
          <div className="kicker">
            {t.welcome}, {name}.
          </div>
          <div className="rule" />
          <h1 className="serif">
            GO<span>BLUEPRINT</span>
          </h1>
          <div className="byline">{nl ? "Audiobook van" : "Audiobook by"} Shoraifa Maayen</div>
          <div className="owned-edition">
            <ShieldCheck size={17} />
            <span>
              {nl ? "PRIVÉ-EDITIE VAN" : "PRIVATE EDITION OF"} {name.toUpperCase()}
            </span>
          </div>
          <p>
            YOUR HEART KNOWS.
            <br />
            YOUR BODY KNOWS.
            <br />
            YOUR SOUL KNOWS.
            <br />
            <span className="quote-tail">
              Sometimes before your mind can explain it.
            </span>
          </p>
          <div className="actions">
            <button className="btn" onClick={enterBlueprint}>
              {hasListeningHistory ? t.continue : t.begin} <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </section>
      {canContinue && active && (
        <section className="continue-panel">
          <img src={active.art || "/assets/go-blueprint-cover.jpeg"} alt="" />
          <div>
            <span className="kicker">{t.continue}</span>
            <h2 className="serif">{active.title}</h2>
            <p>{formatClock(playback[active.id]?.position || 0)}</p>
          </div>
          <button className="btn" onClick={() => openTrack(active)}>
            {t.continue} <Play size={14} />
          </button>
        </section>
      )}
      <section className="section">
        <div className="section-head">
          <div>
            <div className="kicker">{t.library}</div>
            <h2 className="serif">{t.collection}</h2>
          </div>
          <p>
            {nl
              ? "GO BLUEPRINT is de eerste publicatie binnen ROOTED AUDIO. Nieuwe luisterwerelden kunnen later aan dezelfde privébibliotheek worden toegevoegd."
              : "GO BLUEPRINT is the first publication inside ROOTED AUDIO. Future listening worlds can become part of this same private library."}
          </p>
        </div>
      </section>
      <section className="library-edition" aria-label={nl ? "Privébibliotheek" : "Private library edition"}>
        <div>
          <span className="edition-number">{nl ? "PUBLICATIE 01" : "PUBLICATION 01"}</span>
          <h2 className="serif">
            {nl ? "Jouw privébibliotheek." : "Your private library edition."}
          </h2>
          <p>
            {nl
              ? "Een persoonlijke luisterplek voor jouw hoofdstukken, reflecties en de momenten waarnaar je wilt terugkeren."
              : "A personal listening space for your chapters, reflections and the moments you want to return to."}
          </p>
        </div>
        <div className="edition-seal" aria-hidden="true">
          <ShieldCheck size={22} />
          <span>{nl ? <>JOUW<br />EDITIE</> : <>OWNED<br />EDITION</>}</span>
          <small>ROOTED AUDIO</small>
        </div>
      </section>
    </main>
  );
}
function BlueprintView({
  language,
  t,
  active,
  openTrack,
  favorites,
  toggleFavorite,
  setView,
  playback,
  completedCount,
  hasDeepening,
  hasAudiobook,
  checkoutAvailable,
  purchasePrices,
  checkoutBusy,
  startCheckout,
}: {
  language: Lang;
  t: Record<string, string>;
  active: Track | null;
  openTrack: (x: Track) => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  setView: (v: View) => void;
  playback: PlaybackMap;
  completedCount: number;
  hasDeepening: boolean;
  hasAudiobook: boolean;
  checkoutAvailable: boolean;
  purchasePrices: PurchasePrices;
  checkoutBusy: boolean;
  startCheckout: (productId: "go-blueprint-audiobook" | "go-blueprint-deepening") => Promise<void>;
}) {
  const nl = language === "nl";
  const foreword: Track = {
    id: "foreword",
    no: "",
    title: nl ? "VOORWOORD" : "FOREWORD",
    subtitle: nl
      ? "Open de deur naar GO BLUEPRINT."
      : "Open the door to GO BLUEPRINT.",
    type: "foreword",
    art: "/assets/chapter-cards/GO_BLUEPRINT_Voorwoord.webp",
    audio: "/api/audio/foreword",
    durationSeconds: 519,
  };
  const resumableTrack = [
    ...(active ? [active] : []),
    foreword,
    ...chapters,
  ].find((track, index, tracks) => {
    if (tracks.findIndex((candidate) => candidate.id === track.id) !== index) return false;
    const state = playback[track.id];
    return Boolean(state?.position > 1 && !state.completed);
  });
  const canContinue = Boolean(resumableTrack);
  const publicationFavoriteId = "publication-go-blueprint";
  return (
    <main>
      <section className="hero">
        <div className="cover-wrap">
          <img
            className="cover"
            src="/assets/go-blueprint-cover.jpeg"
            alt="Official GO BLUEPRINT Audiobook cover"
          />
        </div>
        <div className="hero-copy">
          <div className="kicker">ROOTED AUDIO · {nl ? "PUBLICATIE 01" : "PUBLICATION 01"}</div>
          <h1 className="serif">GO BLUEPRINT</h1>
          <div className="byline">{nl ? "Door Shoraifa Maayen" : "By Shoraifa Maayen"}</div>
          <div className="audiobook-meta" aria-label={nl ? "Audiobookinformatie" : "Audiobook information"}>
            <span>{nl ? "13 Hoofdstukken" : "13 Chapters"}</span><i>•</i>
            <span>{nl ? "2 uur 12 min" : "2h 12m"}</span><i>•</i>
            <span>{nl ? "Ingesproken door de auteur" : "Narrated by the Author"}</span><i>•</i>
            <span>{nl ? "Nederlands" : "Dutch"}</span>
          </div>
          <div className="actions">
            <button
              className="btn"
              onClick={() => openTrack(resumableTrack || foreword)}
            >
              <Play size={14} /> {canContinue ? (nl ? "VERDER LUISTEREN" : "CONTINUE LISTENING") : (nl ? "BEGIN MET LUISTEREN" : "BEGIN LISTENING")}
            </button>
            <button className="publication-favorite" onClick={() => toggleFavorite(publicationFavoriteId)}>
              <Heart size={15} fill={favorites.includes(publicationFavoriteId) ? "currentColor" : "none"} />
              {favorites.includes(publicationFavoriteId)
                ? (nl ? "TOEGEVOEGD AAN FAVORIETEN" : "ADDED TO FAVORITES")
                : (nl ? "TOEVOEGEN AAN FAVORIETEN" : "ADD TO FAVORITES")}
            </button>
          </div>
          <button
            className="blueprint-jump"
            onClick={() =>
              document
                .getElementById("the-blueprint")
                ?.scrollIntoView({ block: "start" })
            }
          >
            <BookOpen size={15} aria-hidden="true" />
            {nl ? "BEKIJK DE 13 CHAPTER CARDS" : "VIEW THE 13 CHAPTER CARDS"}
          </button>
          <div className="journey-line">
            <span className="kicker">{t.journey}</span>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${(completedCount / 13) * 100}%` }} />
            </div>
            <span className="kicker">
              {completedCount} / 13 {nl ? "VOLTOOID" : "COMPLETED"}
            </span>
          </div>
        </div>
      </section>
      <section className="about-audiobook">
        <div className="about-heading">
          <div className="kicker">{nl ? "OVER DIT AUDIOBOOK" : "ABOUT THIS AUDIOBOOK"}</div>
          <span aria-hidden="true" />
        </div>
        {nl ? (
          <div className="about-copy">
            <p className="about-opening">Je dacht dat het over hen ging.</p>
            <p>De verbinding.<br />Het verlies.<br />Het verlangen.<br />De liefde.</p>
            <p className="about-opening">Tot je beseft dat het jou iets over jezelf laat zien.</p>
            <p>GO BLUEPRINT is een intieme reis door liefde, hechting, wonden, patronen en ontwaken. Een reis door wat de manier waarop je leerde liefhebben heeft gevormd, wat de verbinding kwam onthullen en wat er gebeurt wanneer je eindelijk stopt buiten jezelf naar het ontbrekende stuk te zoeken.</p>
            <p>Dit is geen verhaal over iemand najagen.</p>
            <p className="about-closing">Het gaat over terugkeren naar jezelf.</p>
          </div>
        ) : (
          <div className="about-copy">
            <p className="about-opening">You thought it was about them.</p>
            <p>The connection.<br />The loss.<br />The longing.<br />The love.</p>
            <p className="about-opening">Until you realized it was revealing you.</p>
            <p>GO BLUEPRINT is an intimate journey through love, attachment, wounds, patterns and awakening. A journey through what shaped the way you learned to love, what the connection came to reveal, and what happens when you finally stop looking outside yourself for the missing piece.</p>
            <p>This is not a story about chasing someone.</p>
            <p className="about-closing">It is about returning to yourself.</p>
          </div>
        )}
        <aside className="audiobook-details" aria-label={nl ? "Audiobookdetails" : "Audiobook details"}>
          <div className="details-heading">
            <span className="kicker">{nl ? "DETAILS" : "DETAILS"}</span>
            <small>ROOTED AUDIO · 01</small>
          </div>
          <dl>
            <div>
              <dt>{nl ? "Geschreven door" : "Written by"}</dt>
              <dd>Shoraifa Maayen</dd>
            </div>
            <div>
              <dt>{nl ? "Ingesproken door" : "Narrated by"}</dt>
              <dd>Shoraifa Maayen</dd>
            </div>
            <div>
              <dt>{nl ? "Taal" : "Language"}</dt>
              <dd>{nl ? "Nederlands" : "Dutch"}</dd>
            </div>
            <div>
              <dt>{nl ? "Duur" : "Duration"}</dt>
              <dd>{nl ? "2 uur 12 minuten" : "2 hours 12 minutes"}</dd>
            </div>
            <div>
              <dt>{nl ? "Hoofdstukken" : "Chapters"}</dt>
              <dd>13</dd>
            </div>
            <div>
              <dt>{nl ? "Release" : "Release"}</dt>
              <dd>{nl ? "25 oktober 2026" : "October 25, 2026"}</dd>
            </div>
          </dl>
        </aside>
      </section>
      <section className="section" id="the-blueprint">
        <div className="section-head">
          <div>
            <div className="kicker">{nl ? "DE BLUEPRINT" : "THE BLUEPRINT"}</div>
            <h2 className="serif">{t.allChapters}</h2>
          </div>
          <p>{t.chaptersLead}</p>
        </div>
        <p className="regulation-note">{nl ? "Inclusief korte regulatieoefeningen." : "Includes short regulation practices."}</p>
        <div className="chapter-grid">
          <button
            className="chapter-card foreword"
            onClick={() => openTrack(foreword)}
            aria-label={`${nl ? "VOORWOORD" : "FOREWORD"}: ${foreword.subtitle}`}
          >
            <img className="art" src={foreword.art} alt="" />
            <span className="card-footer">
              <span className="card-meta"><span>{nl ? "DUUR" : "DURATION"} · {formatClock(foreword.durationSeconds || 0)}</span><span>{playback.foreword?.completed ? (nl ? "VOLTOOID" : "COMPLETED") : playback.foreword?.position > 1 ? (nl ? "VERDER" : "CONTINUE") : (nl ? "NIET GESTART" : "NOT STARTED")}</span></span>
              <span className="chapter-action">
                <span>{playback.foreword?.completed ? (nl ? "OPNIEUW LUISTEREN" : "LISTEN AGAIN") : playback.foreword?.position > 1 ? (nl ? "VERDER LUISTEREN" : "CONTINUE") : (nl ? "AFSPELEN" : "PLAY")}</span>
                <ChevronRight size={15} />
              </span>
            </span>
          </button>
          {chapters.map((ch, index) => {
            const state = playback[ch.id];
            const progress = state?.duration ? Math.min(100, (state.position / state.duration) * 100) : 0;
            const action = state?.completed
              ? (nl ? "OPNIEUW LUISTEREN" : "LISTEN AGAIN")
              : state?.position > 1 ? t.continue : t.play;
            return (
            <article
              className="chapter-card"
              key={ch.id}
              role="button"
              tabIndex={0}
              aria-label={`${nl ? "Hoofdstuk" : "Chapter"} ${ch.no}: ${ch.title}. ${nl ? ch.subtitle : chapterSubtitlesEn[index]}`}
              onClick={() => openTrack(ch)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openTrack(ch);
                }
              }}
            >
              <img className="art" src={ch.art} alt="" />
              <span className="card-footer">
                <span className="card-meta"><span>{nl ? "DUUR" : "DURATION"} · {formatClock(ch.durationSeconds || 0)}</span><span>{state?.completed ? (nl ? "VOLTOOID" : "COMPLETED") : state?.position > 1 ? (nl ? "VERDER" : "CONTINUE") : (nl ? "NIET GESTART" : "NOT STARTED")}</span></span>
                {progress > 0 && (
                  <span className="card-progress" aria-label={`${Math.round(progress)}%`}>
                    <i style={{ width: `${progress}%` }} />
                  </span>
                )}
                <span className="chapter-action">
                  <span>{action}</span>
                  <span>
                    <button
                      aria-label={nl ? "Favoriet" : "Favorite"}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(ch.id);
                      }}
                      style={{
                        background: "none",
                        border: 0,
                        color: "inherit",
                        cursor: "pointer",
                      }}
                    >
                      {favorites.includes(ch.id) ? "♥" : "♡"}
                    </button>{" "}
                    <ChevronRight size={15} />
                  </span>
                </span>
              </span>
            </article>
          )})}
        </div>
      </section>
      {completedCount === 13 && (
        <section className="journey-finale">
          <span className="kicker">13 / 13</span>
          <h2>THE BLUEPRINT ENDS WITH YOU.</h2>
          <p>{nl ? <>JE HEBT HET AUDIOBOOK VOLTOOID.<br />GA NU LEVEN WAT JE HEBT GEHOORD.</> : <>YOU FINISHED THE AUDIOBOOK.<br />NOW GO LIVE WHAT YOU HEARD.</>}</p>
        </section>
      )}
      <section className="panel"><a className="btn" href="/journal">Journaling Workbook</a></section>
    </main>
  );
}
function SpaceView({
  t,
  active,
  favorites,
  reflections,
  setReflections,
  openTrack,
  answerCount,
  setView,
  playback,
  setPlayback,
  savedMoments,
  reflectionTimes,
  hasDeepening,
}: {
  t: Record<string, string>;
  active: Track | null;
  favorites: Track[];
  reflections: Record<string, string>;
  setReflections: (x: Record<string, string>) => void;
  openTrack: (x: Track) => void;
  answerCount: number;
  setView: (v: View) => void;
  playback: PlaybackMap;
  setPlayback: Dispatch<SetStateAction<PlaybackMap>>;
  savedMoments: SavedMoment[];
  reflectionTimes: Record<string, number>;
  hasDeepening: boolean;
}) {
  const nl = t.space === "Mijn Plek";
  const foreword: Track = {
    id: "foreword",
    no: "",
    title: nl ? "VOORWOORD" : "FOREWORD",
    subtitle: nl ? "Open de deur naar GO BLUEPRINT." : "Open the door to GO BLUEPRINT.",
    type: "foreword",
    art: "/assets/chapter-cards/GO_BLUEPRINT_Voorwoord.webp",
    audio: "/api/audio/foreword",
  };
  const allTracks = [foreword, ...chapters, ...(hasDeepening ? bonuses : [])].map((track) =>
    localizeTrack(track, nl ? "nl" : "en"),
  );
  const completedCount = chapters.filter((chapter) => playback[chapter.id]?.completed).length;
  const recent = allTracks
    .filter((track) => playback[track.id]?.lastPlayed)
    .sort((a, b) => playback[b.id].lastPlayed.localeCompare(playback[a.id].lastPlayed))
    .slice(0, 3);
  return (
    <main className="section premium-page">
      <header className="private-hero">
        <div>
          <div className="kicker">ROOTED AUDIO · {t.space}</div>
          <h2 className="serif">
            {nl ? (
              <>
                Van jou om naar
                <br />
                <em>terug te keren.</em>
              </>
            ) : (
              <>
                Yours to
                <br />
                <em>return to.</em>
              </>
            )}
          </h2>
          <p>
            {nl
              ? "Alles wat jou raakte, wat je bewaarde en waar je verder wilt schrijven, veilig bij elkaar."
              : "Everything that moved you, that you saved and want to keep writing, held safely in one place."}
          </p>
        </div>
        <div className="private-seal">
          <Sparkles size={19} />
          <span>
            {nl ? (
              <>
                JOUW PRIVÉ
                <br />
                PLEK
              </>
            ) : (
              <>
                YOUR PRIVATE
                <br />
                SANCTUARY
              </>
            )}
          </span>
        </div>
      </header>
      <div className="premium-grid">
        <section className="panel feature-panel">
          <div className="panel-icon">
            <Headphones size={20} />
          </div>
          <div className="kicker">{t.continue}</div>
          <h3>
            {active?.title ||
              (nl
                ? "JOUW REIS BEGINT ZODRA JE OP AFSPELEN DRUKT."
                : "YOUR JOURNEY BEGINS WHEN YOU PRESS PLAY.")}
          </h3>
          <p className="empty">
            {active?.subtitle ||
              (nl
                ? "Wanneer jij er klaar voor bent, staat jouw luisteromgeving voor je klaar."
                : "Whenever you are ready, your listening space is here.")}
          </p>
          {active ? (
            <button className="btn" onClick={() => openTrack(active)}>
              {t.continue}
              <Play size={14} />
            </button>
          ) : (
            <button className="btn" onClick={() => setView("blueprint")}>
              {t.begin}
              <ChevronRight size={14} />
            </button>
          )}
        </section>
        <section className="panel progress-panel">
          <div className="panel-icon">
            <Sparkles size={20} />
          </div>
          <div className="kicker">{t.progress}</div>
          <div className="progress-number">
            <span>{completedCount}</span>
            <small>/ 13</small>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${(completedCount / 13) * 100}%` }} />
          </div>
          <p className="empty">
            {nl
              ? "Jouw tempo is van jou. Je hoeft niets in te halen."
              : "Your pace is yours. There is nothing to catch up on."}
          </p>
        </section>
        <section className="panel saved-moments-panel">
          <div className="panel-icon"><Bookmark size={20} /></div>
          <div className="kicker">{nl ? "OPGESLAGEN MOMENTEN" : "SAVED MOMENTS"}</div>
          <h3>{nl ? "Precies waar iets je raakte." : "Exactly where something moved you."}</h3>
          {savedMoments.length ? savedMoments.slice().reverse().filter((moment, index, items) =>
            !items.slice(0, index).some((other) =>
              other.trackId === moment.trackId && Math.abs(other.position - moment.position) <= 3,
            ),
          ).map((moment) => {
            const track = allTracks.find((item) => item.id === moment.trackId);
            if (!track) return null;
            return <button className="moment-row" key={moment.id} onClick={() => {
              setPlayback((current) => ({ ...current, [track.id]: {
                ...(current[track.id] || { duration: 0, completed: false, lastPlayed: new Date().toISOString() }),
                position: moment.position,
              }}));
              openTrack(track);
            }}><span>{track.title}</span><small>{formatClock(moment.position)}</small></button>;
          }) : <p className="empty">{nl ? "Bewaar een luistermoment vanuit de player." : "Save a listening moment from the player."}</p>}
        </section>
        <section className="panel favorites-panel">
          <div className="panel-icon">
            <Heart size={20} />
          </div>
          <div className="kicker">{t.favorites}</div>
          <h3>
            {nl
              ? "De momenten die jij wilde bewaren."
              : "The moments you chose to keep."}
          </h3>
          {favorites.length ? (
            favorites.map((x) => (
              <div className="saved-row" key={x.id}>
                <span>{x.title}</span>
                <button onClick={() => openTrack(x)}>
                  {nl ? "Openen" : "Open"} <ChevronRight size={14} />
                </button>
              </div>
            ))
          ) : (
            <div className="luxury-empty">
              <Heart size={24} />
              <p>
                {nl
                  ? "DE MOMENTEN DIE JE BEWAART VERSCHIJNEN HIER."
                  : "THE MOMENTS YOU SAVE WILL APPEAR HERE."}
              </p>
            </div>
          )}
        </section>
        {hasDeepening && <section className="panel workbook-panel">
          <div className="panel-icon">
            <BookOpen size={20} />
          </div>
          <div className="kicker">{nl ? "JOUW WORKBOOK" : "YOUR WORKBOOK"}</div>
          <h3>
            <strong>{answerCount}</strong>{" "}
            {nl ? "antwoorden opgeslagen" : "entries saved"}
          </h3>
          <p className="empty">
            {nl
              ? "Jouw antwoorden blijven bewaard tot je terugkomt."
              : "Your answers are kept for your return."}
          </p>
          <button className="btn ghost" onClick={() => setView("workbook")}>
            {t.continueWriting}
            <ChevronRight size={14} />
          </button>
        </section>}
        <section className="panel reflection-panel">
          <div className="reflection-heading">
            <div>
              <div className="kicker">{t.reflection}</div>
              <h3>
                {nl
                  ? "Een pagina die alleen van jou is."
                  : "A page that belongs only to you."}
              </h3>
            </div>
            <span>
              <LockKeyhole size={15} /> {nl ? "PRIVÉ" : "PRIVATE"}
            </span>
          </div>
          <textarea
            className="input"
            value={reflections[active?.id || "general"] || ""}
            onChange={(e) =>
              setReflections({
                ...reflections,
                [active?.id || "general"]: e.target.value,
              })
            }
            placeholder={nl ? "Schrijf wat waar voelt…" : "Write what is true…"}
          />
          <div className="reflection-foot">
            <span>
              <ShieldCheck size={14} />{" "}
              {nl ? "Automatisch privé opgeslagen" : "Auto-saved privately"}
            </span>
            <span>
              {(reflections[active?.id || "general"] || "").length}{" "}
              {nl ? "tekens" : "characters"}
            </span>
          </div>
          {Object.entries(reflections).filter(([, value]) => value.trim()).length > 0 && (
            <div className="reflection-list">
              {Object.entries(reflections).filter(([, value]) => value.trim()).map(([id, value]) => (
                <article key={id}>
                  <small>{allTracks.find((track) => track.id === id)?.title || (nl ? "ALGEMEEN" : "GENERAL")}
                    {reflectionTimes[id] != null ? ` · ${formatClock(reflectionTimes[id])}` : ""}</small>
                  <p>{value}</p>
                </article>
              ))}
            </div>
          )}
        </section>
        {recent.length > 0 && <section className="panel recently-panel">
          <div className="kicker">{nl ? "RECENT BELUISTERD" : "RECENTLY LISTENED"}</div>
          {recent.map((track) => <button className="moment-row" key={track.id} onClick={() => openTrack(track)}>
            <span>{track.title}</span><small>{formatClock(playback[track.id].position)}</small>
          </button>)}
        </section>}
      </div>
    </main>
  );
}
function ProfileView({
  name,
  setName,
  language,
  setLanguage,
  t,
  replayIntro,
  account,
  refreshAccount,
}: {
  name: string;
  setName: (s: string) => void;
  language: Lang;
  setLanguage: (l: Lang) => void;
  t: Record<string, string>;
  replayIntro: () => void;
  account: AccountInfo | null;
  refreshAccount: () => Promise<void>;
}) {
  const initial = (name.trim()[0] || "S").toUpperCase();
  const nl = language === "nl";
  const email = account?.email || "";
  const hasDeepening = false;
  const [deviceMessage, setDeviceMessage] = useState("");
  useEffect(() => { void refreshAccount(); }, [refreshAccount]);
  async function removeDevice(deviceId: string) {
    const confirmed = window.confirm(nl ? "Dit vertrouwde apparaat verwijderen?" : "Remove this trusted device?");
    if (!confirmed) return;
    setDeviceMessage("");
    const response = await fetch(`/api/listening-session?device=${encodeURIComponent(deviceId)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    if (response.ok) {
      await refreshAccount();
      setDeviceMessage(nl ? "Apparaat verwijderd." : "Device removed.");
      return;
    }
    setDeviceMessage(
      nl
        ? "Dit apparaat kon niet worden verwijderd. Probeer het opnieuw."
        : "This device could not be removed. Please try again.",
    );
  }
  return (
    <main className="section premium-page">
      <header className="profile-hero">
        <div className="profile-monogram">
          {initial}
          <span />
        </div>
        <div>
          <div className="kicker">
            ROOTED AUDIO · {nl ? "PRIVÉLID" : "PRIVATE MEMBER"}
          </div>
          <h2 className="serif">{name || (nl ? "Jouw plek" : "Your space")}</h2>
          <p>
            {nl
              ? "Jouw luisterervaring, veilig bij elkaar op één plek."
              : "Your listening experience, held in one secure place."}
          </p>
        </div>
        <div className="access-badge">
          <ShieldCheck size={18} />
          <span>
            {nl ? "PRIVÉTOEGANG" : "PRIVATE ACCESS"}
            <small>{nl ? "BEVEILIGD" : "SECURED"}</small>
          </span>
        </div>
      </header>
      <div className="profile-layout">
        <section className="profile-settings">
          <div className="profile-section-title">
            <PenLine size={19} />
            <div>
              <div className="kicker">
                {nl ? "PERSOONLIJKE GEGEVENS" : "PERSONAL DETAILS"}
              </div>
              <h3>
                {nl ? "Maak deze plek van jou." : "Make this space yours."}
              </h3>
            </div>
          </div>
          <label className="premium-field">
            <span>{t.firstName}</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label={t.firstName}
            />
          </label>
          {email && <div className="account-email"><span>Email</span><strong>{email}</strong></div>}
          <button className="replay-intro" onClick={replayIntro}>
            <Play size={15} /> {nl ? "Intro opnieuw bekijken" : "Replay intro"}
          </button>
          <label className="premium-field">
            <span>{t.languageLabel}</span>
            <div className="select-wrap">
              <Languages size={17} />
              <select
                className="input"
                value={language}
                onChange={(e) => setLanguage(e.target.value as Lang)}
                aria-label={t.languageLabel}
              >
                <option value="nl">Nederlands</option>
                <option value="en">English</option>
              </select>
            </div>
          </label>
          <div className="saved-confirm">
            <ShieldCheck size={15} />
            {t.saved}
          </div>
        </section>
        <aside className="profile-access">
          <div className="kicker">{t.owned}</div>
          <div className="product-pass">
            <img src="/assets/go-blueprint-cover.jpeg" alt="GO BLUEPRINT" />
            <div>
              <small>{nl ? "PUBLICATIE 01" : "PUBLICATION 01"}</small>
              <h3>
                GO
                <br />
                BLUEPRINT
              </h3>
          <p>{hasDeepening ? (nl ? "Audiobook · Verdiepingsbundel" : "Audiobook · Deepening Bundle") : "Audiobook"}</p>
              <span>{nl ? "ACTIEVE TOEGANG" : "ACTIVE ACCESS"}</span>
            </div>
          </div>
          <div className="security-row">
            <LockKeyhole size={20} />
            <div>
              <strong>{t.privateAccess}</strong>
              <small>
                {nl
                  ? "Jouw account en persoonlijke teksten blijven beschermd."
                  : "Your account and personal writing stay protected."}
              </small>
            </div>
          </div>
          <div className="trusted-devices">
            <div className="kicker">{nl ? "VERTROUWDE APPARATEN" : "TRUSTED DEVICES"}</div>
            <p>{nl ? `Maximaal ${account?.deviceLimit || 2} apparaten · één gelijktijdige luisterstream.` : `Up to ${account?.deviceLimit || 2} devices · one listening stream at a time.`}</p>
            {account?.devices.map((device) => (
              <div className="device-row" key={device.id}>
                <span><strong>{device.label}</strong><small>{new Date(device.lastSeenAt).toLocaleDateString(nl ? "nl-NL" : "en-US")}</small></span>
                <button onClick={() => removeDevice(device.id)}>{nl ? "Verwijder" : "Remove"}</button>
              </div>
            ))}
            {deviceMessage && <p role="status" aria-live="polite">{deviceMessage}</p>}
          </div>
          <div className="install-card">
            <div className="kicker">ROOTED AUDIO APP</div>
            <strong>{nl ? "Zet ROOTED AUDIO op je beginscherm." : "Add ROOTED AUDIO to your home screen."}</strong>
            <p>{nl ? "Open het browsermenu en kies ‘Zet op beginscherm’." : "Open your browser menu and choose ‘Add to Home Screen’."}</p>
          </div>
          <a className="logout-link" href={`/auth/signout?lang=${language}`}>
            {t.logout}
            <ChevronRight size={15} />
          </a>
        </aside>
      </div>
    </main>
  );
}

function WorkbookView({
  language,
  t,
  nav,
  answers,
  setAnswers,
  visited,
  section,
  setSection,
}: {
  language: Lang;
  t: Record<string, string>;
  nav: (v: View) => void;
  answers: Record<string, string>;
  setAnswers: (x: Record<string, string>) => void;
  visited: number;
  section: number;
  setSection: (value: number) => void;
}) {
  const nl = language === "nl";
  const questions = nl ? workbookQuestions : workbookQuestionsEn;
  const fillablePdf = "/api/workbook/fillable";
  const printPdf = "/api/workbook/print";
  const [saveStatus, setSaveStatus] = useState<"saving" | "saved" | "error">("saved");
  const goToSection = (next: number) => {
    setSection(Math.max(0, Math.min(14, next)));
    window.requestAnimationFrame(() =>
      document.getElementById("online-workbook")?.scrollIntoView({ block: "start" }),
    );
  };
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; status: "saving" | "saved" | "error" }>).detail;
      if (detail?.key === "ra-workbook") setSaveStatus(detail.status);
    };
    window.addEventListener("ra-save-status", listener);
    return () => window.removeEventListener("ra-save-status", listener);
  }, []);
  async function downloadPersonalWorkbook() {
    setSaveStatus("saving");
    const response = await fetch("/api/state", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: "ra-workbook", value: answers }) }).catch(() => null);
    if (!response?.ok) {
      setSaveStatus("error");
      return;
    }
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;
      const newPage = () => {
        doc.addPage();
        y = margin;
      };
      const ensureSpace = (height: number) => {
        if (y + height > pageHeight - margin) newPage();
      };
      const writeLines = (text: string, size: number, color: [number, number, number], lineHeight: number, bold = false) => {
        doc.setFont("times", bold ? "bold" : "normal");
        doc.setFontSize(size);
        doc.setTextColor(...color);
        const lines = doc.splitTextToSize(text || " ", contentWidth) as string[];
        lines.forEach((line) => {
          ensureSpace(lineHeight);
          doc.text(line, margin, y);
          y += lineHeight;
        });
      };
      const addPrompt = (prompt: string, value: string) => {
        ensureSpace(24);
        y += 5;
        writeLines(prompt, 11, [10, 33, 24], 5.6, true);
        y += 2;
        const answerLines = doc.splitTextToSize(value?.trim() || (nl ? "Nog niet ingevuld" : "Not answered yet"), contentWidth - 8) as string[];
        answerLines.forEach((line) => {
          ensureSpace(8);
          doc.setFillColor(250, 246, 237);
          doc.rect(margin, y - 5, contentWidth, 7.2, "F");
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10.5);
          doc.setTextColor(52, 61, 55);
          doc.text(line, margin + 4, y);
          y += 7.2;
        });
        y += 4;
      };
      const addSection = (label: string, title: string, prompts: Array<[string, string]>) => {
        newPage();
        doc.setDrawColor(198, 160, 96);
        doc.line(margin, y, pageWidth - margin, y);
        y += 10;
        writeLines(label.toUpperCase(), 8.5, [154, 110, 46], 5, true);
        y += 3;
        writeLines(title, 22, [10, 33, 24], 9, false);
        y += 4;
        prompts.forEach(([prompt, value]) => addPrompt(prompt, value));
      };

      doc.setFillColor(6, 25, 18);
      doc.rect(0, 0, pageWidth, pageHeight, "F");
      const coverResponse = await fetch("/assets/go-blueprint-workbook-cover.jpeg");
      if (coverResponse.ok) {
        const coverBlob = await coverResponse.blob();
        const coverData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(coverBlob);
        });
        doc.addImage(coverData, "JPEG", 59, 24, 92, 138, undefined, "FAST");
      }
      doc.setFont("times", "normal");
      doc.setTextColor(231, 201, 148);
      doc.setFontSize(28);
      doc.text("GO BLUEPRINT", pageWidth / 2, 188, { align: "center" });
      doc.setFontSize(22);
      doc.text("WORKBOOK", pageWidth / 2, 201, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(nl ? "MIJN PERSOONLIJKE EDITIE" : "MY PERSONAL EDITION", pageWidth / 2, 218, { align: "center" });
      doc.setFontSize(8);
      doc.text("ROOTED AUDIO · BY ROOTED WITHIN", pageWidth / 2, 274, { align: "center" });

      const openingPrompts: Array<[string, string]> = [
        [nl ? "Wat leeft er nu in mij?" : "What is alive in me right now?", answers["start-0"] || ""],
        [nl ? "Waar voel ik dit in mijn lichaam?" : "Where do I feel this in my body?", answers["start-1"] || ""],
        [nl ? "Wat hoop ik na deze reis helderder te begrijpen?" : "What do I hope to understand more clearly after this journey?", answers["start-2"] || ""],
      ];
      addSection(nl ? "Voordat je begint" : "Before you begin", nl ? "Maak ruimte voor wat waar is." : "Make room for what is true.", openingPrompts);
      questions.forEach(([no, title, q1, q2]) => {
        const prompts = [q1, q2, nl ? "Welke oude regel stuurde mijn gedrag?" : "What old rule was guiding my behavior?", nl ? "Welke concrete keuze past vandaag bij mijn nieuwe richting?" : "What one concrete choice fits my new direction today?"];
        addSection(`${nl ? "Hoofdstuk" : "Chapter"} ${no} / 13`, title, prompts.map((prompt, index) => [prompt, answers[`${no}-${index + 1}`] || ""]));
      });
      const finalPrompts = [
        nl ? "Dit eindigt bij mij…" : "This ends with me…",
        nl ? "Dit neem ik mee…" : "This is what I carry forward…",
        nl ? "Dit ga ik anders bouwen…" : "This is what I will build differently…",
        nl ? "Mijn eerste beweging is…" : "My first movement is…",
      ];
      addSection("GO.", nl ? "De blauwdruk eindigt bij jou." : "The blueprint ends with you.", finalPrompts.map((prompt, index) => [prompt, answers[`final-${index}`] || ""]));
      doc.save(nl ? "GO_BLUEPRINT_Mijn_Workbook.pdf" : "GO_BLUEPRINT_My_Workbook.pdf");
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }
  const modes = [
    {
      title: nl ? "Online invullen" : "Fill in online",
      text: nl
        ? "Schrijf direct in jouw privé Workbook. Je antwoorden worden automatisch bewaard."
        : "Write directly in your private Workbook. Your answers are saved automatically.",
      action: (
        <button
          className="mode-link"
          onClick={() => goToSection(section)}
        >
          {section > 0
            ? (nl ? "Verder schrijven" : "Continue writing")
            : (nl ? "Begin met schrijven" : "Begin writing")}{" "}
          <ChevronRight size={14} />
        </button>
      ),
    },
    {
      title: nl ? "Download mijn Workbook" : "Download my Workbook",
      text: nl ? "Maak een persoonlijke PDF met je laatst opgeslagen antwoorden." : "Create a personal PDF with your latest saved answers.",
      action: <button className="mode-link" onClick={downloadPersonalWorkbook}><Download size={14} /> {nl ? "Maak persoonlijke PDF" : "Create personal PDF"}</button>,
    },
    {
      title: nl ? "Invulbare PDF" : "Fillable PDF",
      text: nl
        ? "Download jouw officiële invulbare PDF om digitaal te gebruiken."
        : "Download your official fillable PDF for digital use.",
      action: (
        <a
          className="mode-link"
          href={`${fillablePdf}?download=1`}
          download="GO_BLUEPRINT_Workbook_Invulbaar.pdf"
        >
          <Download size={14} />{" "}
          {nl ? "Download invulbare PDF" : "Download fillable PDF"}
        </a>
      ),
    },
    {
      title: nl ? "Printversie" : "Print version",
      text: nl
        ? "Download de lege versie om uit te printen en met de hand in te vullen."
        : "Download the blank edition to print and complete by hand.",
      action: (
        <a
          className="mode-link"
          href={`${printPdf}?download=1`}
          download="GO_BLUEPRINT_Workbook_Printversie.pdf"
        >
          <Download size={14} />{" "}
          {nl ? "Download printversie" : "Download print version"}
        </a>
      ),
    },
  ];
  return (
    <div className="workbook">
      <Header view="workbook" nav={nav} t={t} />
      <main className="workbook-inner">
        <header className="paper-head">
          <div className="kicker">GO BLUEPRINT · WORKBOOK</div>
          <h1>
            {nl ? (
              <>
                Jouw eigen
                <br />
                blauwdruk.
              </>
            ) : (
              <>
                Your own
                <br />
                blueprint.
              </>
            )}
          </h1>
          <p>
            {nl
              ? "Een privé plek om te schrijven, terug te keren en opnieuw te beginnen."
              : "A private place to write, return and begin again."}
          </p>
          <p className="workbook-progress">
            {visited} / 13 {nl ? "secties bezocht" : "sections visited"}
          </p>
        </header>
        <section
          className="workbook-modes"
          aria-label={nl ? "Workbook mogelijkheden" : "Workbook options"}
        >
          {modes.map((mode) => (
            <article className="workbook-mode" key={mode.title}>
              <span>0{modes.indexOf(mode) + 1}</span>
              <h2>{mode.title}</h2>
              <p>{mode.text}</p>
              {mode.action}
            </article>
          ))}
        </section>
        <nav id="online-workbook" className="workbook-section-nav" aria-label={nl ? "Workbooksecties" : "Workbook sections"}>
          <button
            type="button"
            onClick={() => goToSection(section - 1)}
            disabled={section === 0}
          >
            <ArrowLeft size={15} /> {nl ? "Vorige" : "Previous"}
          </button>
          <label>
            <span>{nl ? "JOUW HUIDIGE SECTIE" : "YOUR CURRENT SECTION"}</span>
            <select value={section} onChange={(event) => goToSection(Number(event.target.value))}>
              <option value={0}>{nl ? "Voordat je begint" : "Before you begin"}</option>
              {questions.map(([no, title], index) => (
                <option key={no} value={index + 1}>{nl ? "Hoofdstuk" : "Chapter"} {no} — {title}</option>
              ))}
              <option value={14}>{nl ? "Finale" : "Finale"} — GO.</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => goToSection(section + 1)}
            disabled={section === 14}
          >
            {nl ? "Volgende" : "Next"} <ChevronRight size={15} />
          </button>
        </nav>
        {section === 0 && <section className="paper-section workbook-active-section">
          <div className="kicker">
            {nl ? "VOORDAT JE BEGINT" : "BEFORE YOU BEGIN"}
          </div>
          <h2>
            {nl
              ? "Maak ruimte voor wat waar is."
              : "Make room for what is true."}
          </h2>
          {[
            nl ? "Wat leeft er nu in mij?" : "What is alive in me right now?",
            nl
              ? "Waar voel ik dit in mijn lichaam?"
              : "Where do I feel this in my body?",
            nl
              ? "Wat hoop ik na deze reis helderder te begrijpen?"
              : "What do I hope to understand more clearly after this journey?",
          ].map((q, i) => (
            <Prompt
              key={q}
              id={`start-${i}`}
              q={q}
              answers={answers}
              setAnswers={setAnswers}
            />
          ))}
        </section>}
        {section >= 1 && section <= 13 && (() => {
          const [no, title, q1, q2] = questions[section - 1];
          return <section className="paper-section workbook-active-section" key={no}>
            <div className="kicker">
              {nl ? "HOOFDSTUK" : "CHAPTER"} {no} / 13
            </div>
            <h2>{title}</h2>
            <Prompt
              id={`${no}-1`}
              q={q1}
              answers={answers}
              setAnswers={setAnswers}
            />
            <Prompt
              id={`${no}-2`}
              q={q2}
              answers={answers}
              setAnswers={setAnswers}
            />
            <Prompt
              id={`${no}-3`}
              q={
                nl
                  ? "Welke oude regel stuurde mijn gedrag?"
                  : "What old rule was guiding my behavior?"
              }
              answers={answers}
              setAnswers={setAnswers}
            />
            <Prompt
              id={`${no}-4`}
              q={
                nl
                  ? "Welke concrete keuze past vandaag bij mijn nieuwe richting?"
                  : "What one concrete choice fits my new direction today?"
              }
              answers={answers}
              setAnswers={setAnswers}
            />
          </section>;
        })()}
        {section === 14 && <section className="paper-section workbook-active-section">
          <div className="kicker">GO.</div>
          <h2>
            {nl
              ? "De blauwdruk eindigt bij jou."
              : "The blueprint ends with you."}
          </h2>
          {[
            nl ? "Dit eindigt bij mij…" : "This ends with me…",
            nl ? "Dit neem ik mee…" : "This is what I carry forward…",
            nl
              ? "Dit ga ik anders bouwen…"
              : "This is what I will build differently…",
            nl ? "Mijn eerste beweging is…" : "My first movement is…",
          ].map((q, i) => (
            <Prompt
              key={q}
              id={`final-${i}`}
              q={q}
              answers={answers}
              setAnswers={setAnswers}
            />
          ))}
        </section>}
        <nav className="workbook-bottom-nav" aria-label={nl ? "Navigeren tussen Workbooksecties" : "Navigate Workbook sections"}>
          <button type="button" onClick={() => goToSection(section - 1)} disabled={section === 0}>
            <ArrowLeft size={15} /> {nl ? "Vorige sectie" : "Previous section"}
          </button>
          <span>{section === 0 ? (nl ? "START" : "START") : section === 14 ? (nl ? "FINALE" : "FINALE") : `${String(section).padStart(2, "0")} / 13`}</span>
          <button type="button" onClick={() => goToSection(section + 1)} disabled={section === 14}>
            {nl ? "Volgende sectie" : "Next section"} <ChevronRight size={15} />
          </button>
        </nav>
        <div className="save-state">
          <ShieldCheck size={13} /> {saveStatus === "saving" ? (nl ? "OPSLAAN…" : "SAVING…") : saveStatus === "error" ? (nl ? "WE KONDEN DIT NOG NIET OPSLAAN. JE TEKST STAAT HIER NOG." : "WE COULDN’T SAVE THIS YET. YOUR TEXT IS STILL HERE.") : t.saved}
        </div>
      </main>
    </div>
  );
}

function Prompt({
  id,
  q,
  answers,
  setAnswers,
}: {
  id: string;
  q: string;
  answers: Record<string, string>;
  setAnswers: (x: Record<string, string>) => void;
}) {
  return (
    <div className="prompt">
      <label htmlFor={id}>{q}</label>
      <textarea
        id={id}
        value={answers[id] || ""}
        onChange={(e) => setAnswers({ ...answers, [id]: e.target.value })}
      />
    </div>
  );
}

function ListeningRitual({
  language,
  track,
  close,
  enter,
}: {
  language: Lang;
  track: Track;
  close: () => void;
  enter: () => void;
}) {
  const nl = language === "nl";
  return (
    <div className="ritual" role="dialog" aria-modal="true">
      <button className="ritual-close" onClick={close} aria-label={nl ? "Sluiten" : "Close"}>
        <ArrowLeft size={18} />
      </button>
      <div className="ritual-halo" aria-hidden="true" />
      <div className="ritual-inner">
        <img src="/assets/rooted-within-logo.png" alt="Rooted Within" />
        <div className="kicker">{nl ? "JOUW PRIVÉ LUISTERERVARING" : "YOUR PRIVATE LISTENING EXPERIENCE"}</div>
        <span className="ritual-track">
          {track.type === "foreword"
            ? nl
              ? "VOORWOORD"
              : "FOREWORD"
            : track.type === "bonus"
              ? `BONUS ${track.no}`
              : `${nl ? "HOOFDSTUK" : "CHAPTER"} ${track.no} / 13`}
        </span>
        <h2 className="serif">
          {nl ? "Maak ruimte om te luisteren." : "Make space to listen."}
        </h2>
        <div className="ritual-steps">
          <div>
            <Headphones size={22} />
            <span>{nl ? "Doe je koptelefoon op." : "Put on your headphones."}</span>
          </div>
          <div>
            <Moon size={22} />
            <span>{nl ? "Kies een rustig moment." : "Choose a quiet moment."}</span>
          </div>
          <div>
            <Heart size={22} />
            <span>{nl ? "Je hoeft dit niet te haasten." : "You don't have to rush this."}</span>
          </div>
        </div>
        <button className="btn ritual-enter" onClick={enter}>
          {nl ? "OPEN DE LUISTERRUIMTE" : "ENTER THE LISTENING ROOM"}
          <ChevronRight size={15} />
        </button>
        <small>{nl ? "Dit ritueel verschijnt alleen de eerste keer." : "This ritual appears only once."}</small>
      </div>
    </div>
  );
}

function MiniPlayer({
  language,
  active,
  setActive,
  reflection,
  setReflection,
  playback,
  setPlayback,
  favorites,
  toggleFavorite,
  onSaveMoment,
  onPlaybackStart,
  hasDeepening,
}: {
  language: Lang;
  active: Track;
  setActive: Dispatch<SetStateAction<Track | null>>;
  reflection: string;
  setReflection: (value: string, position?: number) => void;
  playback: PlaybackMap;
  setPlayback: Dispatch<SetStateAction<PlaybackMap>>;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  onSaveMoment: (trackId: string, position: number) => void;
  onPlaybackStart: () => void;
  hasDeepening: boolean;
}) {
  const nl = language === "nl";
  const audioRef = useRef<HTMLAudioElement>(null);
  // Keep the listening room closed on entry. The listener opens it deliberately
  // from the persistent mini-player.
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [landed, setLanded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [deviceId] = useState(() => {
    if (typeof window === "undefined") return "";
    let stored = localStorage.getItem("ra-device-id");
    if (!stored) {
      stored = crypto.randomUUID().replace(/-/g, "");
      localStorage.setItem("ra-device-id", stored);
    }
    return stored;
  });
  const [currentDeviceLabel] = useState(() => typeof navigator === "undefined" ? "Personal device" : deviceLabel());
  const [queueOpen, setQueueOpen] = useState(false);
  const queueRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open || !queueOpen) return;
    const queue = queueRef.current;
    queue?.scrollIntoView({ block: "nearest" });
    queue?.focus({ preventScroll: true });
  }, [open, queueOpen]);
  const lastPersisted = useRef(0);
  const switchingTrack = useRef(false);
  const [autoContinue, setAutoContinue] = useStored("ra-auto-continue", true);
  const startNextAtBeginning = useRef(false);
  const [sleepTimer, setSleepTimer] = useStored("ra-sleep-timer", 0);
  const [volume, setVolume] = useStored("ra-volume", 100);
  const [playbackSpeed, setPlaybackSpeed] = useStored("ra-playback-speed", 1);
  const baseTrack =
    active.type === "chapter"
      ? chapters.find((track) => track.id === active.id) || active
      : active.type === "bonus"
        ? bonuses.find((track) => track.id === active.id) ||
          active
        : {
            ...active,
            art: "/assets/chapter-cards/GO_BLUEPRINT_Voorwoord.webp",
            audio: "/api/audio/foreword",
          };
  const chapterIndex = chapters.findIndex((track) => track.id === baseTrack.id);
  const bonusIndex = bonuses.findIndex((track) => track.id === baseTrack.id);
  const currentTrack: Track =
    baseTrack.type === "chapter" && !nl
      ? { ...baseTrack, subtitle: chapterSubtitlesEn[chapterIndex] }
      : baseTrack.type === "bonus" && !nl
        ? { ...baseTrack, subtitle: bonusSubtitlesEn[bonusIndex] }
        : baseTrack.type === "foreword"
          ? {
              ...baseTrack,
              title: nl ? "VOORWOORD" : "FOREWORD",
              subtitle: nl
                ? "Open de deur naar GO BLUEPRINT."
                : "Open the door to GO BLUEPRINT.",
            }
          : baseTrack;
  const foreword: Track = {
    id: "foreword",
    no: "",
    title: nl ? "VOORWOORD" : "FOREWORD",
    subtitle: nl
      ? "Open de deur naar GO BLUEPRINT."
      : "Open the door to GO BLUEPRINT.",
    type: "foreword",
    art: "/assets/chapter-cards/GO_BLUEPRINT_Voorwoord.webp",
    audio: "/api/audio/foreword",
  };
  const listeningOrder = [foreword, ...chapters, ...(hasDeepening ? bonuses : [])];
  const currentIndex = listeningOrder.findIndex(
    (track) => track.id === currentTrack.id,
  );
  const previousTrack =
    currentIndex > 0
      ? [...listeningOrder.slice(0, currentIndex)].reverse().find((track) => track.audio) ?? null
      : null;
  const nextTrack = nextPlaybackTrack(listeningOrder, currentTrack.id);
  const hasAudio = Boolean(currentTrack.audio);
  const securedAudioUrl = currentTrack.audio && deviceId
    ? `${currentTrack.audio}?device=${encodeURIComponent(deviceId)}&label=${encodeURIComponent(currentDeviceLabel)}`
    : undefined;

  // Native media elements hide HTTP error bodies. Read only a one-byte range
  // after a failure so device/auth denials can be explained instead of silently
  // disabling every play button.
  useEffect(() => {
    if (!audioError || !securedAudioUrl) return;
    const controller = new AbortController();
    const trackId = currentTrack.id;
    void fetch(securedAudioUrl, {
      headers: { Range: "bytes=0-0" },
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      if (response.ok) {
        await response.body?.cancel();
        return;
      }
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!controller.signal.aborted && audioRef.current?.dataset.trackId === trackId) {
        setSessionError(payload?.error || "MEDIA_UNAVAILABLE");
      }
    }).catch(() => { /* Keep the visible retry message for network failures. */ });
    return () => controller.abort();
  }, [audioError, securedAudioUrl, currentTrack.id]);

  function formatTime(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60);
    return `${minutes}:${remainder.toString().padStart(2, "0")}`;
  }

  function togglePlay() {
    if (!hasAudio) {
      setOpen(true);
      return;
    }
    setSessionError("");
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      if (audioError) {
        setAudioError(false);
        audio.load();
      }
      void playNativeAudio(audio).catch(() => {
        if (audioRef.current === audio) setPlaying(false);
      });
    } else {
      audio.pause();
    }
  }

  function seekTo(value: number) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(value)) return;
    audio.currentTime = Math.max(0, Math.min(value, audio.duration || value));
    setCurrentTime(audio.currentTime);
    persistPlayback(currentTrack.id, audio.currentTime, audio.duration || duration, false);
  }

  function persistPlayback(trackId: string, position: number, total: number, completed: boolean) {
    setPlayback((current) => ({ ...current, [trackId]: {
      position, duration: total || current[trackId]?.duration || 0,
      completed: completed || current[trackId]?.completed || false,
      lastPlayed: new Date().toISOString(),
    }}));
  }

  function skip(seconds: number) {
    seekTo((audioRef.current?.currentTime || 0) + seconds);
  }

  function changeTrack(
    track: Track | null,
    autoplay = false,
    startAtBeginning = false,
  ) {
    if (!track) return;
    const audio = audioRef.current;
    if (audio && Number.isFinite(audio.currentTime) && audio.currentTime > 0 && !audio.ended) {
      persistPlayback(currentTrack.id, audio.currentTime, audio.duration || duration, false);
    }
    switchingTrack.current = true;
    lastPersisted.current = 0;
    startNextAtBeginning.current = startAtBeginning;
    setPlaying(autoplay);
    setActive(track);
    setCurrentTime(0);
    setDuration(0);
    setAudioError(false);
    setLanded(false);
    setSessionError("");
    // Keep a queue tap's user activation on Safari: set the new source and call
    // play synchronously, rather than waiting for a React effect.
    if (audio && autoplay && track.audio && deviceId) {
      const source = `${track.audio}?device=${encodeURIComponent(deviceId)}&label=${encodeURIComponent(currentDeviceLabel)}`;
      setPlaybackSource(audio, track.id, source);
      void playNativeAudio(audio).catch(() => {
        if (audioRef.current === audio && audio.dataset.trackId === track.id) setPlaying(false);
      });
    }
  }
  function cycleSleepTimer() {
    const choices = [0, 15, 30, 45, 60];
    const current = choices.indexOf(sleepTimer);
    setSleepTimer(choices[(current + 1) % choices.length]);
  }
  function cycleVolume() {
    setVolume(volume <= 25 ? 100 : volume - 25);
  }
  function cyclePlaybackSpeed() {
    const choices = [0.75, 1, 1.25, 1.5, 1.75, 2];
    const current = choices.indexOf(playbackSpeed);
    setPlaybackSpeed(choices[(current + 1) % choices.length]);
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume / 100;
    audio.defaultPlaybackRate = playbackSpeed;
    audio.playbackRate = playbackSpeed;
  }, [volume, playbackSpeed, currentTrack.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !securedAudioUrl) return;
    if (audio.getAttribute("src") !== securedAudioUrl) switchingTrack.current = true;
    setPlaybackSource(audio, currentTrack.id, securedAudioUrl);
    if (playing) {
      if (audio.paused) void playNativeAudio(audio).catch(() => { if (audioRef.current === audio) setPlaying(false); });
    } else {
      audio.pause();
    }
  }, [playing, securedAudioUrl, currentTrack.id]);

  useEffect(() => {
    if (!deviceId) return;
    let cancelled = false;
    const updateSession = async (action: "heartbeat" | "stop") => {
      const send = () => fetch("/api/listening-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          deviceId,
          deviceLabel: currentDeviceLabel,
          trackId: currentTrack.id,
        }),
        keepalive: action === "stop",
      }).catch(() => null);
      const response = action === "heartbeat" ? await retryListeningRequest(send, () => cancelled) : await send();
      if (cancelled) return;
      if (action === "heartbeat" && (!response || !response.ok)) {
        const payload = response ? await response.json().catch(() => null) as { error?: string } | null : null;
        if (cancelled) return;
        const code = payload?.error || (response ? `HTTP_${response.status}` : "NETWORK_UNAVAILABLE");
        console.warn("ROOTED_AUDIO_SESSION", code);
        setSessionError(code);
        setPlaying(false);
        audioRef.current?.pause();
      }
    };
    if (!playing) {
      void updateSession("stop");
      return () => { cancelled = true; };
    }
    void updateSession("heartbeat");
    const timer = window.setInterval(() => void updateSession("heartbeat"), 30_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [playing, deviceId, currentDeviceLabel, currentTrack.id]);

  useEffect(() => {
    if (!playing || !sleepTimer) return;
    const timer = window.setTimeout(
      () => setPlaying(false),
      sleepTimer * 60 * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [playing, sleepTimer]);

  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentTrack.audio) return;
    if (typeof MediaMetadata !== "undefined") {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title,
          artist: "Shoraifa Maayen",
          album: "GO BLUEPRINT",
          artwork: [{ src: currentTrack.art || "/assets/go-blueprint-cover.jpeg" }],
        });
      } catch { /* Metadata must never interrupt playback. */ }
    }
    return installNativeMediaActions({
      play: () => {
        const audio = audioRef.current;
        if (!audio) return;
        setSessionError("");
        void playNativeAudio(audio).catch(() => {
          if (audioRef.current === audio) setPlaying(false);
        });
      },
      pause: () => audioRef.current?.pause(),
      seekbackward: (details) => skip(-(details.seekOffset || 15)),
      seekforward: (details) => skip(details.seekOffset || 15),
      seekto: (details) => { if (details.seekTime != null) seekTo(details.seekTime); },
      previoustrack: previousTrack ? () => changeTrack(previousTrack, true) : undefined,
      nexttrack: nextTrack ? () => changeTrack(nextTrack, true) : undefined,
    });
  }, [currentTrack.id, currentTrack.audio, hasDeepening, duration]);

  return (
    <aside className="player" aria-label={nl ? "Audiospeler" : "Audio player"}>
      <audio
        ref={audioRef}
        data-track-id={currentTrack.id}
        preload="none"
        onLoadedMetadata={(event) => {
          const audio = event.currentTarget;
          if (audio.dataset.trackId !== currentTrack.id) return;
          setDuration(audio.duration || 0);
          syncNativeMediaState(audio);
          const saved = playback[currentTrack.id]?.position || 0;
          const completed = playback[currentTrack.id]?.completed;
          if (
            !startNextAtBeginning.current &&
            !completed &&
            saved > 0 &&
            saved < audio.duration - 3
          ) {
            audio.currentTime = saved;
            setCurrentTime(saved);
            lastPersisted.current = saved;
          } else {
            audio.currentTime = 0;
            setCurrentTime(0);
            lastPersisted.current = 0;
          }
          startNextAtBeginning.current = false;
          switchingTrack.current = false;
          setAudioError(false);
          if (playing) void playNativeAudio(audio).catch(() => { if (audioRef.current === audio) setPlaying(false); });
        }}
        onTimeUpdate={(event) => {
          if (switchingTrack.current || event.currentTarget.dataset.trackId !== currentTrack.id) return;
          syncNativeMediaState(event.currentTarget);
          const time = event.currentTarget.currentTime;
          setCurrentTime(time);
          if (time - lastPersisted.current >= 5) {
            lastPersisted.current = time;
            persistPlayback(currentTrack.id, time, event.currentTarget.duration, false);
          }
        }}
        onPlay={(event) => { if (event.currentTarget.paused) return; onPlaybackStart(); setPlaying(true); syncNativeMediaState(event.currentTarget); }}
        onRateChange={(event) => syncNativeMediaState(event.currentTarget)}
        onPause={(event) => {
          if (event.currentTarget !== audioRef.current || ignorePlaybackPause(event.currentTarget, switchingTrack.current)) return;
          syncNativeMediaState(event.currentTarget);
          setPlaying(false);
          const audio = event.currentTarget;
          const trackId = audio.dataset.trackId || currentTrack.id;
          const reachedEnd = Number.isFinite(audio.duration) && audio.duration > 0 && audio.currentTime >= audio.duration - 0.5;
          const wasCompleted = playback[trackId]?.completed || false;
          persistPlayback(trackId, audio.currentTime, audio.duration, reachedEnd || wasCompleted);
        }}
        onEnded={(event) => {
          if (event.currentTarget !== audioRef.current || !event.currentTarget.ended || event.currentTarget.dataset.trackId !== currentTrack.id) return;
          const trackId = event.currentTarget.dataset.trackId || currentTrack.id;
          persistPlayback(trackId, event.currentTarget.duration || duration, event.currentTarget.duration || duration, true);
          const continuation = nextPlaybackTrack(listeningOrder, currentTrack.id, autoContinue);
          if (continuation) {
            changeTrack(continuation, true, true);
          } else {
            setPlaying(false);
            setLanded(true);
            setOpen(true);
          }
        }}
        onError={(event) => {
          if (event.currentTarget !== audioRef.current || !event.currentTarget.error) return;
          setAudioError(true);
          setPlaying(false);
        }}
      />
      {!open && sessionError && (
        <div className="session-alert" role="alert" data-error-code={sessionError}>
          {sessionError === "DEVICE_LIMIT_REACHED"
            ? (nl ? "Je account heeft al twee vertrouwde apparaten. Verwijder eerst een apparaat via Profiel." : "Your account already has two trusted devices. Remove one in Profile first.")
            : sessionError === "ANOTHER_DEVICE_IS_LISTENING"
              ? (nl ? "Dit account luistert al op een ander apparaat." : "This account is already listening on another device.")
              : (nl ? "Je beveiligde luistersessie kon niet worden gestart. Probeer opnieuw." : "Your secure listening session could not be started. Please try again.")}
        </div>
      )}
      <div className="player-inner">
        <button className="track-name" onClick={() => setOpen(true)}>
          <img className="mini-track-art" src={currentTrack.art} alt="" />
          <span>
            <small>
              {currentTrack.type === "bonus"
                ? `BONUS ${currentTrack.no}`
                : currentTrack.type === "foreword"
                  ? nl
                    ? "VOORWOORD"
                    : "FOREWORD"
                  : `${currentTrack.no} / 13`}
            </small>
            <div>{currentTrack.title}</div>
          </span>
        </button>
        <div className="controls">
          <button
            className="circle secondary track-skip"
            aria-label={nl ? "Vorig luisteronderdeel" : "Previous track"}
            disabled={!previousTrack}
            onClick={() => changeTrack(previousTrack, true)}
          >
            <SkipBack size={16} />
          </button>
          <button
            className="circle"
            aria-label={playing ? (nl ? "Pauzeren" : "Pause") : (nl ? "Afspelen" : "Play")}
            onClick={togglePlay}
            disabled={!hasAudio}
          >
            {playing ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <button
            className="circle secondary track-skip"
            aria-label={nl ? "Volgend luisteronderdeel" : "Next track"}
            disabled={!nextTrack}
            onClick={() => changeTrack(nextTrack, true)}
          >
            <SkipForward size={16} />
          </button>
        </div>
        <button className="player-note" onClick={() => setOpen(true)}>
          {nl ? "Luisterinstellingen" : "Listening settings"}{" "}
          <ChevronRight size={14} />
        </button>
      </div>
      {open && (
        <div className="modal player-modal" onClick={() => setOpen(false)}>
          <div className="listening-room" onClick={(e) => e.stopPropagation()}>
            <button
              className="close-player"
              onClick={() => setOpen(false)}
              aria-label={nl ? "Sluiten" : "Close"}
            >
              <ArrowLeft size={18} />
            </button>
            <div className="listening-art">
              <img
                src={currentTrack.art}
                alt={`${currentTrack.title} chapter card`}
              />
            </div>
      {sessionError && (
        <div className="session-alert" role="alert" data-error-code={sessionError}>
          {sessionError === "DEVICE_LIMIT_REACHED"
            ? (nl ? "Je account heeft al twee vertrouwde apparaten. Verwijder eerst een apparaat via Profiel." : "Your account already has two trusted devices. Remove one in Profile first.")
            : sessionError === "ANOTHER_DEVICE_IS_LISTENING"
              ? (nl ? "Dit account luistert al op een ander apparaat." : "This account is already listening on another device.")
              : (nl ? "Je beveiligde luistersessie kon niet worden gestart. Probeer opnieuw." : "Your secure listening session could not be started. Please try again.")}
        </div>
      )}
            <div className="room-title">
              <span className="kicker">
                {currentTrack.type === "bonus"
                  ? `BONUS ${currentTrack.no}`
                  : currentTrack.type === "foreword"
                    ? nl
                      ? "VOORWOORD"
                      : "FOREWORD"
                    : `${nl ? "HOOFDSTUK" : "CHAPTER"} ${currentTrack.no} / 13`}
              </span>
              <small><ShieldCheck size={13} /> {nl ? "PRIVÉ LUISTERSESSIE" : "PRIVATE LISTENING SESSION"}</small>
            </div>
            <div className="player-wave" aria-hidden="true">
              {Array.from({ length: 29 }, (_, i) => (
                <i key={i} style={{ height: `${18 + ((i * 17) % 48)}%` }} />
              ))}
            </div>
            <div className="audio-progress">
              <input
                type="range"
                min="0"
                max={duration || 0}
                step="0.1"
                value={Math.min(currentTime, duration || 0)}
                onChange={(event) => seekTo(Number(event.target.value))}
                aria-label={nl ? "Afspeelpositie" : "Playback position"}
                disabled={!hasAudio || !duration}
                style={
                  {
                    "--audio-progress": `${duration ? (currentTime / duration) * 100 : 0}%`,
                  } as CSSProperties
                }
              />
              <span>{formatTime(currentTime)}</span>
              <span>{duration ? formatTime(duration) : "--:--"}</span>
            </div>
            <div className="main-controls">
              <button
                aria-label={nl ? "15 seconden terug" : "15 seconds back"}
                onClick={() => skip(-15)}
                disabled={!hasAudio}
              >
                <RotateCcw />
                <small>15</small>
              </button>
              <button
                className="main-play"
                aria-label={playing ? (nl ? "Pauzeren" : "Pause") : (nl ? "Afspelen" : "Play")}
                onClick={togglePlay}
                disabled={!hasAudio}
              >
                {playing ? <Pause /> : <Play />}
              </button>
              <button
                aria-label={nl ? "15 seconden vooruit" : "15 seconds forward"}
                onClick={() => skip(15)}
                disabled={!hasAudio}
              >
                <SkipForward />
                <small>15</small>
              </button>
            </div>
            <nav
              className="track-navigation"
              aria-label={
                nl
                  ? "Navigeren tussen luisteronderdelen"
                  : "Navigate between tracks"
              }
            >
              <button
                disabled={!previousTrack}
                onClick={() => changeTrack(previousTrack, true)}
              >
                <SkipBack size={18} />
                <span>
                  <small>{nl ? "VORIGE" : "PREVIOUS"}</small>
                  {previousTrack?.title ||
                    (nl ? "Dit is het begin" : "This is the beginning")}
                </span>
              </button>
              <button
                disabled={!nextTrack}
                onClick={() => changeTrack(nextTrack, true)}
              >
                <span>
                  <small>{nl ? "VOLGENDE" : "NEXT"}</small>
                  {nextTrack?.title ||
                    (nl ? "Dit is het einde" : "This is the ending")}
                </span>
                <SkipForward size={18} />
              </button>
            </nav>
            <div className="moment-actions">
              <button className={favorites.includes(currentTrack.id) ? "active" : ""} onClick={() => toggleFavorite(currentTrack.id)}>
                <Heart size={17} /> {favorites.includes(currentTrack.id) ? (nl ? "Bewaard" : "Favorited") : (nl ? "Favoriet" : "Favorite")}
              </button>
              <button onClick={() => onSaveMoment(currentTrack.id, currentTime)}>
                <Bookmark size={17} /> {nl ? "Bewaar dit moment" : "Save this moment"} · {formatTime(currentTime)}
              </button>
              <button aria-expanded={queueOpen} aria-controls="listening-queue" onClick={() => setQueueOpen((value) => !value)}>
                <Library size={17} /> {nl ? "Luisterlijst" : "Queue"}
              </button>
            </div>
            {queueOpen && <section id="listening-queue" ref={queueRef} tabIndex={-1} className="player-queue" aria-label={nl ? "Luisterlijst" : "Listening queue"}>
              <div className="queue-heading">
                <span>{nl ? "LUISTERLIJST" : "LISTENING QUEUE"}</span>
                <small>{listeningOrder.length} {nl ? "onderdelen" : "tracks"}</small>
              </div>
              {listeningOrder.map((track) => {
                const localizedTrack = localizeTrack(track, language);
                const state = playback[track.id];
                return <button
                  key={track.id}
                  className={track.id === currentTrack.id ? "active" : ""}
                  aria-current={track.id === currentTrack.id ? "true" : undefined}
                  onClick={() => {
                    setQueueOpen(false);
                    changeTrack(track, true);
                  }}
                >
                  <small>{track.type === "chapter" ? `${track.no} / 13` : track.type === "bonus" ? `BONUS ${track.no}` : (nl ? "VOORWOORD" : "FOREWORD")}</small>
                  <span>{localizedTrack.title}</span>
                  <em>{state?.completed ? (nl ? "VOLTOOID" : "COMPLETED") : state?.position > 1 ? `${nl ? "VERDER" : "CONTINUE"} · ${formatTime(state.position)}` : (nl ? "AFSPELEN" : "PLAY")}</em>
                </button>;
              })}
            </section>}
            <div className="settings-heading">
              <span>
                <Timer size={18} />{" "}
                {nl ? "Luisterinstellingen" : "Listening settings"}
              </span>
              <small>
                {autoContinue
                  ? nl
                    ? "Automatisch verder: aan"
                    : "Auto-continue: on"
                  : nl
                    ? "Automatisch verder: uit"
                    : "Auto-continue: off"}
              </small>
            </div>
            <div className="listening-settings">
              <button
                className={autoContinue ? "active" : ""}
                aria-pressed={autoContinue}
                onClick={() => setAutoContinue(!autoContinue)}
              >
                <SkipForward size={17} />{" "}
                {nl ? "Automatisch verder" : "Auto-continue"}:{" "}
                {autoContinue ? (nl ? "aan" : "on") : nl ? "uit" : "off"}
              </button>
              <button onClick={cycleSleepTimer}>
                <Moon size={17} /> {nl ? "Slaaptimer" : "Sleep timer"}:{" "}
                {sleepTimer ? `${sleepTimer} min` : nl ? "uit" : "off"}
              </button>
              <button onClick={cycleVolume}>
                <Volume2 size={17} /> Volume: {volume}%
              </button>
              <button onClick={cyclePlaybackSpeed}>
                <Timer size={17} /> {nl ? "Snelheid" : "Speed"}: {playbackSpeed}
                ×
              </button>
            </div>
            {(audioError || hasAudio) && (
              <p className="audio-status" aria-live="polite">
                {audioError
                  ? nl
                    ? "Deze audio kon niet worden geladen. Probeer het opnieuw."
                    : "This audio could not be loaded. Please try again."
                  : nl
                    ? "Je luisterpositie wordt automatisch bewaard."
                    : "Your listening position is saved automatically."}
              </p>
            )}
            {currentTrack.id === "chapter-13" && !hasAudio && !landed && (
              <div className="finale-preview">
                <span className="kicker">{nl ? "HOOFDSTUK 13 · SLOTERVARING" : "CHAPTER 13 · CLOSING EXPERIENCE"}</span>
                <button onClick={() => setLanded(true)}>
                  {nl ? "BEKIJK FINALE" : "VIEW FINALE"}
                  <ChevronRight size={15} />
                </button>
              </div>
            )}
            {landed && currentTrack.id !== "chapter-13" && (
              <section className="let-it-land">
                <span className="kicker">ROOTED AUDIO</span>
                <h3>{nl ? "LAAT HET LANDEN." : "LET IT LAND."}</h3>
                <p>
                  {nl
                    ? "Je hoeft niet alles nu te begrijpen. Blijf nog even bij wat je hebt gevoeld."
                    : "You don't have to understand everything right now. Stay with what you felt for a moment."}
                </p>
                <div>
                  <button onClick={() => document.getElementById("chapter-reflection")?.scrollIntoView({ behavior: "smooth" })}>
                    {nl ? "REFLECTEER" : "REFLECT"}
                  </button>
                  <button onClick={() => nextTrack && changeTrack(nextTrack, true)} disabled={!nextTrack}>
                    {nl ? "GA VERDER" : "CONTINUE"}
                  </button>
                  <button onClick={() => setOpen(false)}>{nl ? "KEER LATER TERUG" : "RETURN LATER"}</button>
                </div>
              </section>
            )}
            {landed && currentTrack.id === "chapter-13" && (
              <section className="finale-panel">
                <span>I&apos;M NOT THE BLACK SHEEP.</span>
                <strong>I&apos;M THE BLUEPRINT.</strong>
                <i>GO.</i>
                <h3>THE BLUEPRINT ENDS WITH YOU.</h3>
                <div>
                  <button onClick={() => setOpen(false)}>{nl ? "TERUG NAAR ROOTED AUDIO" : "RETURN TO ROOTED AUDIO"}</button>
                  <button onClick={() => document.getElementById("chapter-reflection")?.scrollIntoView({ behavior: "smooth" })}>
                    {nl ? "MIJN REFLECTIE" : "MY REFLECTION"}
                  </button>
                </div>
              </section>
            )}
            <section className="chapter-reflection">
              <div className="reflection-kicker">
                {nl ? "KORTE REFLECTIE" : "SHORT REFLECTION"} ·{" "}
                {currentTrack.type === "bonus"
                  ? `BONUS ${currentTrack.no}`
                  : currentTrack.type === "foreword"
                    ? nl
                      ? "VOORWOORD"
                      : "FOREWORD"
                    : `${nl ? "HOOFDSTUK" : "CHAPTER"} ${currentTrack.no}`}
              </div>
              <h3>
                {nl ? (
                  <>
                    Wat wil er <em>in jou landen?</em>
                  </>
                ) : (
                  <>
                    What wants to <em>land within you?</em>
                  </>
                )}
              </h3>
              <label htmlFor="chapter-reflection">
                {nl
                  ? "Wat heeft dit luistermoment in jou zichtbaar gemaakt?"
                  : "What did this listening moment reveal within you?"}
              </label>
              <textarea
                id="chapter-reflection"
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder={
                  nl
                    ? "Schrijf wat er in je opkomt. Niet mooi, alleen eerlijk…"
                    : "Write what comes to mind. Not polished, only honest…"
                }
              />
              <div className="reflection-private">
                <ShieldCheck size={14} /> {nl
                  ? "Privé · automatisch bewaard · later aanpasbaar"
                  : "Private · saved automatically · editable later"}
              </div>
              <button onClick={() => setReflection(reflection, currentTime)}>
                {nl ? "Reflectie opslaan" : "Save reflection"}
              </button>
            </section>
          </div>
        </div>
      )}
    </aside>
  );
}
function Cinematic({ language, close }: { language: Lang; close: () => void }) {
  const nl = language === "nl";
  return (
    <div className="cinematic">
      <button className="skip" onClick={close}>
        {nl ? "INTRO OVERSLAAN" : "SKIP INTRO"}
      </button>
      <div>
        <div className="kicker">ROOTED WITHIN {nl ? "PRESENTEERT" : "PRESENTS"}</div>
        <h1>
          GO
          <br />
          <span>BLUEPRINT</span>
        </h1>
        <div className="quote">
          Your heart knows.
          <br />
          Your body knows.
          <br />
          Your soul knows.
          <br />
          <span className="mind-line">
            Sometimes before your mind can explain it.
          </span>
        </div>
        <button className="btn" style={{ marginTop: 38 }} onClick={close}>
          {nl ? "BEGINNEN" : "BEGIN"}
        </button>
      </div>
    </div>
  );
}
