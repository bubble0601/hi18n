/* eslint-disable @typescript-eslint/ban-types, @typescript-eslint/no-explicit-any */

import {
  defaultErrorHandler,
  ErrorHandler,
  ErrorLevel,
} from "./error-handling.js";
import {
  MessageError,
  MissingLocaleError,
  MissingTranslationError,
  NoLocaleError,
} from "./errors.js";
import { EvalOption, evaluateMessage } from "./msgfmt-eval.js";
import type {
  ComponentPlaceholder,
  InferredMessageType,
} from "./msgfmt-parser-types.js";
import { parseMessage } from "./msgfmt-parser.js";
import { CompiledMessage } from "./msgfmt.js";

export * from "./error-handling.js";
export * from "./errors.js";
export type { ComponentPlaceholder } from "./msgfmt-parser-types.js";

declare const messageBrandSymbol: unique symbol;
declare const translationIdBrandSymbol: unique symbol;

/**
 * A subtype of `string` that represents translation messages.
 *
 * @param Args parameters required by this message
 *
 * @since 0.1.0 (`@hi18n/core`)
 */
export type Message<Args = {}> = string & {
  [messageBrandSymbol]: (args: Args) => void;
};

/**
 * A base type for a vocabulary.
 *
 * A vocabulary here means a set of translation ids required for this book of translations.
 *
 * @since 0.1.0 (`@hi18n/core`)
 */
export type VocabularyBase = Record<string, Message<any>>;

/**
 * Extracts parameters required by the translated message.
 *
 * @param M the message being instantiated.
 * @param C replacement for the component interpolation (like `<0></0>` or `<link></link>`).
 *
 * @since 0.1.0 (`@hi18n/core`)
 */
export type MessageArguments<
  M extends Message<any>,
  C
> = InstantiateComponentTypes<
  InjectAdditionalParams<AbstractMessageArguments<M>>,
  C
>;

// It if uses Date, we need timeZone as well.
export type InjectAdditionalParams<Args> = true extends HasDate<
  Args[keyof Args]
>
  ? Args & { timeZone: string }
  : Args;

export type HasDate<T> = T extends Date ? true : never;

export type AbstractMessageArguments<M extends Message<any>> =
  M extends Message<infer Args> ? Args : never;

export type InstantiateComponentTypes<Args, C> = {
  [K in keyof Args]: InstantiateComponentType<Args[K], C>;
};
export type InstantiateComponentType<T, C> = T extends ComponentPlaceholder
  ? C
  : T;

/**
 * A subtype of `string` that represents a dynamically-managed translation id.
 *
 * @param Vocabulary the vocabulary type of the Book it refers to
 * @param Args parameters required by this message
 *
 * @since 0.1.1 (`@hi18n/core`)
 */
export type TranslationId<
  Vocabulary extends VocabularyBase,
  Args = {}
> = string & {
  [translationIdBrandSymbol]: (catalog: Vocabulary, args: Args) => void;
};

/**
 * Extracts the translation ids that don't take parameters.
 *
 * @param Vocabulary the vocabulary, a set of translation ids we can use for this book of translations.
 * @param K a dummy parameter to do a union distribution
 *
 * @since 0.1.0 (`@hi18n/core`)
 */
export type SimpleMessageKeys<
  Vocabulary extends VocabularyBase,
  K extends string & keyof Vocabulary = string & keyof Vocabulary
> = K extends unknown
  ? {} extends MessageArguments<Vocabulary[K], never>
    ? K
    : never
  : never;

/**
 * Infers the appropriate type for the translated message.
 *
 * At runtime, it just returns the first argument.
 *
 * @param s the translated message
 * @returns the first argument
 *
 * @since 0.1.0 (`@hi18n/core`)
 *
 * @example
 *   ```ts
 *   export default new Book<Vocabulary>({
 *     "example/greeting": msg("Hello, {name}!"),
 *   });
 *   ```
 */
export function msg<S extends string>(s: S): InferredMessageType<S> {
  return s as InferredMessageType<S>;
}

/**
 * Same as {@link msg} but can be used to indicate an untranslated state.
 *
 * At runtime, it just returns the first argument.
 *
 * @param s the translated message
 * @returns the first argument
 *
 * @since 0.1.3 (`@hi18n/core`)
 *
 * @example
 *   ```ts
 *   export default new Book<Vocabulary>({
 *     "example/greeting": msg.todo("Hello, {name}!"),
 *   });
 *   ```
 */
msg.todo = function todo<S extends string>(s: S): InferredMessageType<S> {
  return s as InferredMessageType<S>;
};

/**
 * Marks a translation id as dynamically used with {@link CompoundTranslatorFunction.dynamic t.dynamic}.
 *
 * At runtime, it just returns the second argument.
 *
 * @param book the book the id is linked to. Just discarded at runtime.
 * @param id the translation id.
 * @returns the second argument
 *
 * @since 0.1.1 (`@hi18n/core`)
 *
 * @example
 *   ```ts
 *   const menus = [
 *     {
 *       url: "https://example.com/home",
 *       titleId: translationId(book, "example/navigation/home"),
 *     },
 *     {
 *       url: "https://example.com/map",
 *       titleId: translationId(book, "example/navigation/map"),
 *     },
 *   ];
 *
 *   const { t } = getTranslator(book, "en");
 *   t.dynamic(menus[i].titleId);
 *   ```
 */
export function translationId<
  Vocabulary extends VocabularyBase,
  K extends string
>(
  book: Book<Vocabulary>,
  id: K
): Vocabulary[K] extends Message
  ? TranslationId<Vocabulary, AbstractMessageArguments<Vocabulary[K]>>
  : never {
  const _book = book;
  return id as string as TranslationId<
    Vocabulary,
    AbstractMessageArguments<Vocabulary[K]>
  > &
    never;
}

/**
 * A set of translated messages, containing translations for all supported locales.
 *
 * In other words, a book is a set of {@link Catalog}s for all languages.
 *
 * @since 0.1.0 (`@hi18n/core`)
 *
 * @example
 *   ```ts
 *   type Vocabulary = {
 *     "example/greeting": Message<{ name: string }>;
 *   };
 *   export const book = new Book<Vocabulary>({
 *     en: catalogEn,
 *     ja: catalogJa,
 *   });
 *   ```
 *
 * @example You can use `import()` to lazy-load catalogs.
 *   Note that you need to use extra setup to avoid the
 *   "Catalog not loaded" error.
 *
 *   ```ts
 *   type Vocabulary = {
 *     "example/greeting": Message<{ name: string }>;
 *   };
 *   export const book = new Book<Vocabulary>({
 *     en: () => import("./en"),
 *     ja: () => import("./ja"),
 *   });
 *   ```
 */
export class Book<Vocabulary extends VocabularyBase> {
  readonly catalogs: Record<string, Catalog<Vocabulary>>;
  readonly _loaders: Readonly<
    Record<string, Catalog<Vocabulary> | CatalogLoader<Vocabulary>>
  >;
  _handleError?: ErrorHandler | undefined;
  _implicitLocale?: string | undefined;
  constructor(
    catalogs: Readonly<
      Record<string, Catalog<Vocabulary> | CatalogLoader<Vocabulary>>
    >,
    options: BookOptions = {}
  ) {
    this.catalogs = {};
    this._loaders = catalogs;
    this._handleError = options.handleError;
    this._implicitLocale = options.implicitLocale;

    for (const [locale, catalog] of Object.entries(catalogs)) {
      // Skip lazy-loaded catalogs
      if (typeof catalog === "function") continue;

      this.catalogs[locale] = catalog;
      // @ts-expect-error deliberately breaking privacy
      if (catalog._looseLocale) {
        catalog.locale = locale;
      } else if (catalog.locale !== locale) {
        throw new Error(
          `Locale mismatch: expected ${locale}, got ${catalog.locale!}`
        );
      }
    }

    if (
      this._implicitLocale != null &&
      !hasOwn(catalogs, this._implicitLocale)
    ) {
      throw new Error(`Invalid implicitLocale: ${this._implicitLocale}`);
    }
  }

  /**
   * Load a catalog for specific locale.
   *
   * Consider using {@link preloadCatalogs} instead.
   *
   * @param locale locale to load
   *
   * @since 0.1.9 (`@hi18n/core`)
   */
  public async loadCatalog(locale: string): Promise<void> {
    const loader = this._loaders[locale];
    if (typeof loader !== "function") return;

    const { default: catalog } = await loader();
    // @ts-expect-error deliberately breaking privacy
    if (catalog._looseLocale) {
      catalog.locale = locale;
    } else if (catalog.locale !== locale) {
      throw new Error(
        `Locale mismatch: expected ${locale}, got ${catalog.locale!}`
      );
    }
    if (this.catalogs[locale] != null) return;
    this.catalogs[locale] = catalog;
  }

  public handleError(e: Error, level: ErrorLevel) {
    (this._handleError ?? defaultErrorHandler)(e, level);
  }
}

/**
 * @since 0.1.7 (`@hi18n/core`)
 */
export type BookOptions = {
  /**
   * Custom error handler. {@link defaultErrorHandler} is used by default.
   *
   * @example
   *   ```ts
   *   export const book = new Book({
   *     en: catalogEn,
   *     ja: catalogJa,
   *   }, {
   *     handleError(error, level) {
   *       if (level === "error") {
   *         // Report to Sentry or somewhere
   *       } else {
   *         console.warn(error);
   *       }
   *     }
   *   });
   *   ```
   *
   * @since 0.1.7 (`@hi18n/core`)
   */
  handleError?: ErrorHandler | undefined;
  /**
   * Locale fallback to use when no valid locale is specified.
   *
   * @example
   *   ```ts
   *   export const book = new Book({
   *     en: catalogEn,
   *     ja: catalogJa,
   *   }, { implicitLocale: "en" });
   *   ```
   *
   * @since 0.1.7 (`@hi18n/core`)
   */
  implicitLocale?: string | undefined;
};

/**
 * A function to asynchronously load a catalog.
 *
 * It is usually provided as `() => import("...")`.
 *
 * @since 0.1.9 (`@hi18n/core`)
 */
export type CatalogLoader<Vocabulary extends VocabularyBase> = () => Promise<{
  default: Catalog<Vocabulary>;
}>;

/**
 * A set of translated messages for a specific locale.
 *
 * @since 0.1.0 (`@hi18n/core`)
 *
 * @example
 *   ```ts
 *   type Vocabulary = {
 *     "example/greeting": Message<{ name: string }>;
 *   };
 *   export default new Catalog<Vocabulary>("en", {
 *     "example/greeting": msg("Hello, {name}!"),
 *   });
 *   ```
 */
export class Catalog<Vocabulary extends VocabularyBase> {
  // TODO: make it non-nullish and readonly in 0.2.0
  public locale?: string | undefined;
  public readonly data: Readonly<Vocabulary>;
  // TODO: remove it in 0.2.0
  private _looseLocale = false;
  private _compiled: Record<string, CompiledMessage> = {};
  /**
   * @since 0.1.6 (`@hi18n/core`)
   */
  constructor(locale: string, data: Readonly<Vocabulary>);
  /**
   * @deprecated deprecated from 0.1.6. Please specify the locale.
   * @since 0.1.0 (`@hi18n/core`)
   */
  constructor(data: Readonly<Vocabulary>);
  constructor(
    locale: string | Readonly<Vocabulary>,
    data?: Readonly<Vocabulary>
  ) {
    if (typeof locale === "object") {
      // For backwards-compatibility
      // TODO: remove it in 0.2.0
      this.data = locale;
      this._looseLocale = true;
    } else {
      this.locale = locale;
      this.data = data!;
    }
  }

  getCompiledMessage(id: string & keyof Vocabulary): CompiledMessage {
    if (!hasOwn(this._compiled, id)) {
      if (!hasOwn(this.data, id)) {
        throw new MissingTranslationError();
      }
      const msg = this.data[id]!;
      this._compiled[id] = parseMessage(msg);
    }
    return this._compiled[id]!;
  }
}

/**
 * An object returned from {@link getTranslator}.
 *
 * @since 0.1.0 (`@hi18n/core`)
 */
export type TranslatorObject<Vocabulary extends VocabularyBase> = {
  /**
   * Returns the translated message.
   *
   * @since 0.1.0 (`@hi18n/core`)
   *
   * @example
   *   ```ts
   *   const { t } = getTranslator(book, "en");
   *   t("example/greeting-simple"); // => "Hello!"
   *   ```
   */
  t: CompoundTranslatorFunction<Vocabulary>;

  /**
   * Similar to {@link TranslatorObject.t} but allows component interpolation
   * (i.e. to interpret commands like `<0>foo</0>` or `<link>foo</link>`)
   *
   * Users usually don't need to call it manually.
   * See the `@hi18n/react` package for its application to React.
   *
   * @param id the id of the translation
   * @param interpolator functions to customize the interpolation behavior
   * @param options the parameters of the translation.
   *
   * @since 0.1.0 (`@hi18n/core`)
   */
  translateWithComponents<T, C, K extends string & keyof Vocabulary>(
    id: K,
    interpolator: ComponentInterpolator<T, C>,
    options: MessageArguments<Vocabulary[K], C>
  ): T | string;
};

type CompoundTranslatorFunction<Vocabulary extends VocabularyBase> =
  TranslatorFunction<Vocabulary> & {
    /**
     * Returns the translated message for a dynamic id.
     *
     * @since 0.1.1 (`@hi18n/core`)
     *
     * @example
     *   ```ts
     *   const { t } = getTranslator(book, "en");
     *   t.dynamic(menus[i].titleId); // => "Map"
     *   ```
     */
    dynamic: DynamicTranslatorFunction<Vocabulary>;

    /**
     * Declares a translation to be made.
     *
     * At runtime, it returns the first argument.
     *
     * @param id the id of the translation
     * @param options the parameters of the translation.
     *
     * @since 0.1.1 (`@hi18n/core`)
     *
     * @example
     *   ```ts
     *   const { t } = getTranslator(book, "en");
     *   t.todo("example/greeting-simple"); // => "[TODO: example/greeting-simple]"
     *   ```
     */
    todo(id: string, options?: Record<string, unknown>): string;
  };

type TranslatorFunction<Vocabulary extends VocabularyBase> = {
  /**
   * Returns the translated message for a simple one.
   *
   * @param id the id of the translation
   *
   * @since 0.1.0 (`@hi18n/core`)
   *
   * @example
   *   ```ts
   *   const { t } = getTranslator(book, "en");
   *   t("example/greeting-simple"); // => "Hello!"
   *   ```
   */
  <K extends string>(id: K): Vocabulary[K] extends Message ? string : never;

  /**
   * Returns the translated message.
   *
   * @param id the id of the translation
   * @param options the parameters of the translation.
   *
   * @since 0.1.0 (`@hi18n/core`)
   *
   * @example
   *   ```ts
   *   const { t } = getTranslator(book, "en");
   *   t("example/greeting", { name: "John" }); // => "Hello, John!"
   *   ```
   */
  <K extends string & keyof Vocabulary>(
    id: K,
    options: MessageArguments<Vocabulary[K], never>
  ): string;
};

type DynamicTranslatorFunction<Vocabulary extends VocabularyBase> = {
  /**
   * Returns the translated message for a simple dynamic id.
   *
   * @param id the id of the translation
   *
   * @since 0.1.1 (`@hi18n/core`)
   *
   * @example
   *   ```ts
   *   const { t } = getTranslator(book, "en");
   *   t.dynamic(menus[i].titleId); // => "Map"
   *   ```
   */
  (id: TranslationId<Vocabulary, {}>): string;

  /**
   * Returns the translated message for a dynamic id.
   *
   * @param id the id of the translation
   * @param options the parameters of the translation.
   *
   * @since 0.1.1 (`@hi18n/core`)
   *
   * @example
   *   ```ts
   *   const { t } = getTranslator(book, "en");
   *   t.dynamic(greetings[i].translationId, { name: "John" }); // => "Hello, John!"
   *   ```
   */
  <Args>(
    id: TranslationId<Vocabulary, Args>,
    options: InstantiateComponentTypes<InjectAdditionalParams<Args>, never>
  ): string;
};

/**
 * Used in {@link TranslatorObject.translateWithComponents} to customize
 * the behavior of component interpolation.
 *
 * @since 0.1.0 (`@hi18n/core`)
 */
export type ComponentInterpolator<T, C> = {
  collect: (submessages: (T | string)[]) => T | string;
  wrap: (component: C, message: T | string | undefined) => T | string;
};

/**
 * Retrieves the translation helpers from the book and the locales.
 *
 * @param book the "book" (i.e. the set of translations) containing the desired messages.
 * @param locales a locale or a list of locale in the order of preference (the latter being not supported yet)
 * @param options.throwPromise if true, it throws a Promise instance instead of an error. Used for React Suspense integration.
 * @returns A set of translation helpers
 *
 * @since 0.1.0 (`@hi18n/core`)
 *
 * @example
 *   ```ts
 *   const { t } = getTranslator(book, "en");
 *   t("example/greeting-simple"); // => "Hello!"
 *   ```
 */
export function getTranslator<Vocabulary extends VocabularyBase>(
  book: Book<Vocabulary>,
  locales: string | string[],
  options: GetTranslatorOptions = {}
): TranslatorObject<Vocabulary> {
  const locale = selectLocale(book, locales);
  const catalog = book.catalogs[locale];
  if (catalog == null) {
    if (options.throwPromise) {
      throw book.loadCatalog(locale);
    } else {
      throw new Error(`Catalog not loaded: ${locale}`);
    }
  }

  const t = (id: string, options: Record<string, unknown> = {}): string => {
    try {
      return compileAndEvaluateMessage<Vocabulary, string>(
        catalog,
        locale,
        id,
        {
          timeZone: options["timeZone"] as string | undefined,
          params: options,
          handleError: book._handleError,
        }
      );
    } catch (e) {
      if (!(e instanceof Error)) throw e;

      book.handleError(e, "error");
      return `[${id}]`;
    }
  };
  t.dynamic = t;
  t.todo = (id: string) => {
    return `[TODO: ${id}]`;
  };

  return {
    t: t as CompoundTranslatorFunction<Vocabulary>,
    translateWithComponents: <T, C, K extends string & keyof Vocabulary>(
      id: K,
      interpolator: ComponentInterpolator<T, C>,
      options: MessageArguments<Vocabulary[K], C>
    ): T | string => {
      try {
        return compileAndEvaluateMessage<Vocabulary, T>(catalog, locale, id, {
          timeZone: options["timeZone"] as string | undefined,
          params: options,
          handleError: book._handleError,
          collect: interpolator.collect,
          wrap: interpolator.wrap as ComponentInterpolator<T, unknown>["wrap"],
        });
      } catch (e) {
        if (!(e instanceof Error)) throw e;

        book.handleError(e, "error");
        return `[${id}]`;
      }
    },
  };
}

/**
 * options for {@link getTranslator}
 *
 * @since 0.1.9 (`@hi18n/core`)
 */
export type GetTranslatorOptions = {
  /** if true, it throws a Promise instance instead of an error. Used for React Suspense integration. */
  throwPromise?: boolean | undefined;
};

/**
 * Starts loading and waits for catalogs so that {@link getTranslator} does not error
 * with "Catalog not loaded" error.
 *
 * It is a wrapper for {@link Book.loadCatalog}.
 *
 * @param book same as {@link getTranslator}'s `book` parameter.
 * @param locales same as {@link getTranslator}'s `locales` parameter.
 *
 * @since 0.1.9 (`@hi18n/core`)
 */
export async function preloadCatalogs<Vocabulary extends VocabularyBase>(
  book: Book<Vocabulary>,
  locales: string | string[]
): Promise<void> {
  const locale = selectLocale(book, locales);
  const catalog = book.catalogs[locale];
  if (catalog == null) {
    await book.loadCatalog(locale);
  }
}

// To ensure deterministic behavior,
// this function picks the locale whether the catalog has already been loaded or not.
function selectLocale<Vocabulary extends VocabularyBase>(
  book: Book<Vocabulary>,
  locales: string | string[]
): string {
  const localesArray = Array.isArray(locales) ? locales : [locales];

  const filteredLocales: string[] = [];
  for (const locale of localesArray) {
    if (hasOwn(book._loaders, locale)) {
      filteredLocales.push(locale);
    }
  }

  if (filteredLocales.length === 0) {
    const error =
      localesArray.length === 0
        ? new NoLocaleError()
        : new MissingLocaleError({
            locale: localesArray[0]!,
            availableLocales: Object.keys(book._loaders),
          });
    if (book._implicitLocale != null) {
      book.handleError(error, "error");
      filteredLocales.push(book._implicitLocale);
    } else {
      throw error;
    }
  }

  return filteredLocales[0]!;
}

function compileAndEvaluateMessage<Vocabulary extends VocabularyBase, T>(
  catalog: Catalog<Vocabulary>,
  locale: string,
  id: string & keyof Vocabulary,
  options: Omit<EvalOption<T>, "id" | "locale">
) {
  try {
    return evaluateMessage<T>(catalog.getCompiledMessage(id), {
      id,
      locale,
      ...options,
    });
  } catch (e) {
    if (!(e instanceof Error)) throw e;

    throw new MessageError({
      cause: e,
      id,
      locale,
    });
  }
}

/**
 * A convenience helper to get the default time zone.
 * If you need more sophisticated guess for old browsers,
 * consider using other libraries like `moment.tz.guess`.
 *
 * @returns the default time zone, if anything is found. Otherwise the string "UTC"
 *
 * @since 0.1.3 (`@hi18n/core`)
 */
export function getDefaultTimeZone(): string {
  if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (typeof timeZone === "string") return timeZone;
  }
  return "UTC";
}

function hasOwn(o: object, s: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(o, s);
}
