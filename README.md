# Akita Neru

Akita Neru, `discord.js` v14 ile geliştirilen açık kaynaklı bir Discord moderasyon botudur. Bot,
gizlilik ve en az ayrıcalık ilkesi gereği yalnız slash komutları kullanır; mesaj içeriklerini okumaz ve
ayrıcalıklı `Message Content` intent'ine ihtiyaç duymaz.

## Özellikler

- Güvenli slash komut altyapısı ve ayrı komut kayıt akışı
- Kullanıcı izni, bot izni ve rol hiyerarşisi için çalışma zamanı kontrolleri
- Sunucu sahibi, komutu çalıştıran kullanıcı ve bot için hedef korumaları
- Cooldown, güvenli hata yanıtları ve hassas veri redaksiyonu
- Kontrollü kapanma ve kalıcı yapılandırma hatalarında hızlı başarısızlık
- Node.js yerleşik test sistemi, ESLint, Prettier ve GitHub Actions kontrolleri

## Gereksinimler

- Node.js 22.13 veya daha yeni bir desteklenen sürüm (Node.js 22/24 LTS önerilir)
- Bir Discord uygulaması ve bot hesabı
- Botu davet edebileceğiniz bir Discord sunucusu

## Kurulum

```bash
git clone https://github.com/meiruoyeta/Akita-Neru.git
cd Akita-Neru
npm ci
```

Yapılandırma örneğini kopyalayın:

Linux/macOS:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

`.env` içindeki alanlar:

```dotenv
DISCORD_TOKEN=replace_with_your_bot_token
DISCORD_CLIENT_ID=123456789012345678
DISCORD_GUILD_ID=
```

- `DISCORD_TOKEN`: Developer Portal içindeki Bot sayfasından alınan gizli token.
- `DISCORD_CLIENT_ID`: Uygulamanın Application ID değeri; komut kaydı için gereklidir.
- `DISCORD_GUILD_ID`: İsteğe bağlı geliştirme sunucusu kimliği. Girilirse komutlar bu sunucuya anında
  kaydedilir; boş bırakılırsa global kayıt yapılır.

Gerçek `.env` dosyası Git tarafından yok sayılır. Tokeni hiçbir zaman commit etmeyin, ekran görüntüsüne
eklemeyin veya loglarda paylaşmayın. Sızan bir tokeni Developer Portal üzerinden hemen yenileyin.

## Botu davet etme

Developer Portal içindeki **OAuth2 > URL Generator** bölümünde şu scope'ları seçin:

- `bot`
- `applications.commands`

Bot permissions bölümünde yalnız kullanacağınız özelliklerin gerektirdiği izinleri verin:

- View Channels
- Kick Members
- Ban Members
- Moderate Members
- Manage Messages
- Read Message History

`Administrator` izni vermeyin. Discord rol hiyerarşisinde botun rolünü, yönetmesini istediğiniz rollerin
üzerine taşıyın.

## Komutları kaydetme ve botu başlatma

Slash komutlarını Discord'a kaydedin:

```bash
npm run deploy:commands
```

`DISCORD_GUILD_ID` boşsa global komutların yayılması bir saate kadar sürebilir. Geliştirme sırasında bir
sunucu kimliği kullanmak değişiklikleri anında görünür yapar.

Botu başlatın:

```bash
npm start
```

Alternatif olarak Linux/macOS üzerinde `./run.sh`, Windows üzerinde `run.bat` kullanılabilir. Bu
betikler kendi klasörlerine geçer ve işlemin çıkış kodunu korur; kalıcı yapılandırma hatalarını sonsuz
restart döngüsüne sokmaz. Üretimde yeniden başlatma politikası için systemd, Docker veya benzeri bir
süreç yöneticisi kullanın.

## Komutlar

| Komut      | Gerekli kullanıcı izni | Açıklama                                     |
| ---------- | ---------------------- | -------------------------------------------- |
| `/help`    | Yok                    | Kullanılabilir komutları listeler            |
| `/ping`    | Yok                    | Discord ve etkileşim gecikmesini gösterir    |
| `/kick`    | Kick Members           | Bir üyeyi sunucudan çıkarır                  |
| `/ban`     | Ban Members            | Bir kullanıcıyı yasaklar                     |
| `/timeout` | Moderate Members       | Bir üyeyi en fazla 28 gün kısıtlar           |
| `/purge`   | Manage Messages        | Son 1-100 mesajı güvenli biçimde toplu siler |

Moderasyon komutlarında Discord'un komut görünürlüğü kontrollerine ek olarak izinler çalışma anında da
doğrulanır. Eşit/yüksek rollere, sunucu sahibine, bota veya komutu çalıştıran kullanıcıya işlem
uygulanamaz. `/purge`, sabitlenmiş ve 14 günden eski mesajları atlar.

## Geliştirme ve doğrulama

```bash
npm test
npm run test:coverage
npm run lint
npm run format:check
npm run audit
npm run check
```

`npm run check`, lint, biçim ve kapsam eşikli testlerin tamamını çalıştırır. Testler gerçek Discord
tokeni veya ağ bağlantısı gerektirmez. CI, Node.js 22 ve 24 üzerinde hem Ubuntu hem Windows ortamında
aynı kontrolleri çalıştırır.

Yeni bir komut `commands/` altında şu sözleşmeyle tanımlanmalıdır:

```js
import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder().setName('ornek').setDescription('Örnek komut'),
  cooldown: 3,
  async execute(interaction) {
    await interaction.reply('Merhaba!');
  },
};
```

Loader; bozuk export, eksik `execute`, geçersiz event veya mükerrer komut adında bot Discord'a
bağlanmadan önce işlemi durdurur.

## Sorun giderme

- `DISCORD_TOKEN eksik`: `.env.example` dosyasını `.env` olarak kopyaladığınızdan emin olun.
- `Missing Access` / `Missing Permissions`: OAuth izinlerini ve bot rolünün hiyerarşisini kontrol edin.
- Slash komutları görünmüyor: `npm run deploy:commands` çalıştırın; global kayıt kullandıysanız yayılmayı
  bekleyin.
- Bot exit code `78` ile kapanıyor: Kalıcı yapılandırma hatası vardır; `.env` değerlerini düzeltin.

## Güvenlik ve lisans

Güvenlik açığı bildirimleri için [SECURITY.md](SECURITY.md) dosyasını okuyun. Proje
[GPL-3.0-or-later](LICENSE.txt) lisansı altında yayımlanır.
