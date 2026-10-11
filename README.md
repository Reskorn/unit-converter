# Unit converter

Mühendislik birimleri için tek başına çalışan birim dönüştürücü. Uzunluk, kütle, basınç, enerji ve sıcaklık dönüşümleri; son 10 dönüşümün geçmişi; açık/koyu tema; telefonda da çalışır.

Framework yok, build adımı yok. Sadece HTML + CSS + JavaScript.

## GitHub Pages ile yayınlama

1. GitHub'da yeni bir repo aç (örneğin `unit-converter`).
2. Bu klasördeki dosyaları reponun kök dizinine yükle: `index.html`, `style.css`, `app.js`, `README.md`.
3. Repo → **Settings → Pages → Build and deployment**: Source olarak **Deploy from a branch**, branch olarak **main** ve klasör olarak **/ (root)** seç.
4. Birkaç dakika sonra site `https://<kullanici-adin>.github.io/unit-converter/` adresinde yayında olur.

## Yerelde çalıştırma

`index.html` dosyasına çift tıkla ya da klasörde `npx serve` çalıştır.

## Dosyalar

```
index.html   → sayfa iskeleti, üst çubuk, tema scripti
style.css    → tasarım değişkenleri ve sadece bu araçta kullanılan bileşenler
app.js       → dönüşüm hesapları, arayüz, geçmiş, tema
```

Dönüşüm fonksiyonları Node'dan da test edilebilir:

```
node -e "console.log(require('./app.js').convertUnit(100, '°C', '°F'))"
```

## Yeni birim eklemek

`app.js` içindeki `UNIT_TABLE` nesnesine, kategorinin temel birimine (m, kg, Pa, J) göre çarpanı ile ekle. Örnek: `Length` içine `nmi: 1852`.
