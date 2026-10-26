# Steam Shelf languages / 语言

Use the **中文 / EN** buttons in the top bar to change the interface language. The choice is saved locally and applies on the next launch. On first launch, English system locales use English; other locales use Simplified Chinese.

点击顶栏的 **中文 / EN** 即时切换语言。选择保存在本机，重启后继续生效。首次启动跟随系统语言；英文系统使用英文，其他语言默认简体中文。

The interface, accessibility labels, status and sorting menus, arrangement tools, game and collectible inspectors, help, notifications, generated case text and default shelf labels are localized. Game names use existing English names when available. User content and artwork are not machine translated.

Steam descriptions are requested in `english` or `schinese`. Requests and disk caches are separated by language. If Steam does not provide localized content, the content supplied by Steam is shown. Changing languages does not modify library IDs, saved status keys, order, placement or custom artwork.

## Implementation

- `src/i18n.js`: locale preference, subscriptions, source-key translations, template formatting and date/name helpers.
- `src/translations.js`: English translations keyed by stable Chinese source text.
- `src/useLocale.js`: reactive subscriptions for the app and canvas inspectors.
- `electron/details.cjs`: separate request and disk-cache keys for each language.
- `tests/i18n.test.mjs`: persistence, formatting, presentation/source identifiers and dictionary coverage.
- `tests/localized-details.test.cjs`: concurrent language requests, request deduplication and cache isolation using mocked Steam responses.

Language preference is stored separately from collection backups under `steam-shelf-language`, so switching languages never rewrites collection data.
