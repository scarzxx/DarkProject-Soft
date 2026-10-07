# Changelog
 Číslo musí odpovídat `version` v `package.json`.

Příklad:

```md
## 0.4.3

- Nový design podsvícení.
- Lepší rozložení ovládacích prvků.
- Opravené načítání profilů.
```

## 0.4.2

- Vydávání nových verzí bylo zjednodušeno.
- Změna `version` v `package.json` automaticky synchronizuje verzi aplikace a vytvoří odpovídající GitHub tag a Release.
- Veřejný Release obsahuje jediný Windows setup EXE, který používá také vestavěný updater.

## 0.4.3

- Opraveno přeskakování jasu po kliknutí na „Použít na klávesnici“.
- Posuvník nyní nabízí podporované úrovně: 0, 25, 50, 75 a 100 %.
- Importované profily předem zobrazují jas, který se skutečně uloží.