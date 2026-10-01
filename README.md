# NEXA 2.0 — kiểu Zalo, dữ liệu nằm trong Google Drive

Ứng dụng chat cho công ty / gia đình, chạy bằng **Node.js thuần (không cần cài thư viện nào)**.
Mọi dữ liệu (tài khoản, tin nhắn, ảnh, tệp) nằm trong **một thư mục Google Drive**. Không cần thuê máy chủ, không cần cơ sở dữ liệu.

> **Phiên bản 2 KHÔNG đọc được dữ liệu của phiên bản 1** (định dạng lưu trữ đã đổi để phục vụ 1000 người). Hãy dùng thư mục dữ liệu mới.

---

## 1. Cách hoạt động với Google Drive (đọc kỹ phần này)

Google Drive chỉ là **kho lưu trữ**, không chạy được mã chương trình và không có kết nối thời gian thực, nên bản thân Drive (hoặc Apps Script) **không thể** phục vụ 1000 người chat cùng lúc (giới hạn số lần gọi, độ trễ vài giây). Vì vậy ứng dụng được thiết kế như sau:

```
  1000 trình duyệt (điện thoại / máy tính) ──► 1 máy đang chạy start.bat ──► thư mục Google Drive
                                                (bất kỳ máy nào có thư mục Drive)        (Drive tự đồng bộ lên đám mây)
```

* **Không cần một máy chủ cố định.** Máy nào cài *Google Drive for desktop* và có thư mục dữ liệu đều chạy được chương trình. Bạn có thể chạy trên máy văn phòng, máy tính bàn, NAS hoặc laptop.
* **Chỉ MỘT máy làm máy chủ tại một thời điểm** (cơ chế “lease” — tệp `lease.json` trong thư mục dữ liệu, gia hạn mỗi 10 giây). Các máy khác cùng chạy `start.bat` sẽ tự vào **chế độ dự phòng** và **tự tiếp quản** khi máy chính tắt (tắt bình thường: gần như ngay lập tức; mất điện đột ngột: khoảng 90 giây). Đã kiểm thử: `node tests/failover.js`.
* **Nhân viên KHÔNG cần quyền truy cập Google Drive.** Họ chỉ mở đường link của máy chủ trên trình duyệt. Chỉ những người quản trị / máy chủ mới cần được chia sẻ thư mục Drive.
* **Toàn bộ thư mục dữ liệu là bí mật của công ty** (chứa `secret.key` ký phiên đăng nhập và mật khẩu đã băm). Chỉ chia sẻ cho người quản trị.

### Thiết lập thư mục Google Drive
1. Cài **Google Drive for desktop**, đăng nhập bằng tài khoản Google dùng chung của công ty.
2. Tạo thư mục, ví dụ `My Drive/NEXA`. Nhấp chuột phải → **Sẵn có ngoại tuyến / Available offline** (hoặc chọn chế độ *Mirror files*) để tệp luôn nằm sẵn trên đĩa của máy chủ — đừng dùng chế độ chỉ “stream”, sẽ chậm.
3. Mở `config.json`, sửa `dataDir` thành đường dẫn thư mục đó, ví dụ:
   * Windows: `"dataDir": "G:/My Drive/NEXA"`
   * macOS: `"dataDir": "/Users/ten/Library/CloudStorage/GoogleDrive-email/My Drive/NEXA"`
4. **Không tự mở / sửa tệp trong thư mục này khi máy chủ đang chạy** (dễ gây xung đột đồng bộ).

### Dữ liệu được lưu thế nào (để Drive không bị nghẽn)
* Tin nhắn ghi **nối thêm** vào các đoạn `.jsonl` nhỏ (~512 KB) theo từng hội thoại: chỉ đoạn mới nhất thay đổi, Drive chỉ đồng bộ tệp nhỏ.
* Ghi theo lô (gom nhiều thay đổi rồi ghi một lần), ghi nguyên tử (tệp tạm rồi đổi tên) nên không hỏng tệp khi mất điện.
* Trạng thái “đã đọc / lần truy cập cuối” gom ghi mỗi 30 giây.
* Tất cả dữ liệu đang dùng nằm trong RAM của máy chủ (tin nhắn cũ nạp dần khi cuộn lên, bộ nhớ đệm tự giải phóng). Người dùng **không** đọc trực tiếp từ Drive nên Drive không thể là điểm nghẽn.
* Hạn chế: mất điện đột ngột có thể mất tối đa vài giây thay đổi chưa ghi (tin nhắn được ghi sau ≤ 0,3 giây; cài đặt hồ sơ ≤ 3 giây; trạng thái đã đọc ≤ 30 giây).
* Nên xem thư mục Drive có `logs/` (nhật ký) và sao lưu định kỳ bằng tính năng *phiên bản* của Drive.

---

## 2. Chạy thử trong 3 phút

1. Cài **Node.js 20 trở lên** (đã kiểm thử trên Node 22): https://nodejs.org
2. Sửa `dataDir` trong `config.json` (mục 1). Nếu chỉ chạy thử, để nguyên `./data`.
3. Windows: nhấp đúp **`start.bat`**. macOS/Linux: `./start.sh`.
4. Màn hình hiện địa chỉ, ví dụ `http://192.168.1.10:3000` — gửi cho mọi người trong cùng mạng nội bộ.
5. **Người đăng ký đầu tiên tự động là Quản trị viên.** Vào Cài đặt → *Giới hạn và đăng ký* để chọn chế độ đăng ký và hạn mức dung lượng, rồi *Quản lý người dùng → Nhập hàng loạt* để dán danh sách nhân viên từ Excel.

### Để 1000 người ở nhiều nơi cùng dùng
* **Cùng mạng văn phòng / VPN:** dùng địa chỉ LAN ở trên (mở cổng 3000 trên tường lửa của máy chủ).
* **Từ Internet (khuyến nghị):** dùng **Cloudflare Tunnel** hoặc **Tailscale Funnel** — có HTTPS miễn phí, không phải mở cổng router. Khi đó đặt `"trustProxy": true` trong `config.json` để máy chủ lấy đúng địa chỉ IP thật (phục vụ chống tấn công). **Chỉ bật khi thật sự đứng sau proxy đáng tin cậy**, nếu không kẻ tấn công có thể giả IP.

---

## 3. HTTPS (bắt buộc cho gọi video, chụp màn hình, vị trí, ghi âm)

Trình duyệt chỉ cho dùng camera, micro, chia sẻ màn hình, GPS trên trang **HTTPS** (hoặc `localhost`). Hai cách:
* Dùng Cloudflare Tunnel / Tailscale (có sẵn HTTPS hợp lệ) — **cách dễ nhất**, không cảnh báo.
* Hoặc tự ký: chạy `node tools/make-cert.js 192.168.1.10 chat.congty.local`, đặt `"https": true` trong `config.json`, chạy lại. Lần đầu mỗi người sẽ thấy cảnh báo chứng chỉ → *Nâng cao → Tiếp tục truy cập*. Có thể dùng chứng chỉ thật: `"https": {"key": "...", "cert": "..."}`.

## 4. Gọi thoại / video

* Dùng WebRTC: hình và tiếng đi **trực tiếp giữa các máy**, máy chủ chỉ chuyển tín hiệu nên gần như không tốn tài nguyên. Gọi nhóm tối đa `maxCallGroup` người (mặc định 6, mạng lưới P2P).
* Trong cùng mạng nội bộ chạy ngay. Nếu hai người ở **hai mạng khác nhau** sau tường lửa nghiêm ngặt (4G ↔ văn phòng) có thể cần máy chủ **TURN**. Cài `coturn` rồi khai báo trong `config.json`:
  ```json
  "turn": { "urls": ["turn:turn.congty.vn:3478"], "secret": "chuoi-bi-mat-dung-chung-voi-coturn" }
  ```
  (với coturn bật `use-auth-secret` và `static-auth-secret=<secret>`; máy chủ tự cấp tài khoản tạm 1 ngày cho từng người). Hoặc dùng `"username"`/`"credential"` cố định.
* Chia sẻ màn hình: nút ở thanh điều khiển cuộc gọi. Chụp màn hình gửi tin: nút hình màn hình ở ô soạn tin → chọn cửa sổ/màn hình → trình chỉnh sửa mở ra.

**Không muốn ai phải bấm “Cho phép”?** Trình duyệt bắt buộc hỏi quyền micro/camera (quy định bảo mật, không phần mềm web nào tự bỏ qua được). NEXA xử lý theo thứ tự tối ưu:
1. **Ứng dụng .exe / Android / iOS**: tự cấp quyền cho chính địa chỉ máy chủ — không hỏi.
2. **Máy công ty dùng Chrome/Edge**: *Cài đặt → Truy cập → Micro/camera* tải file `.reg` (cho Chrome hoặc Edge) cấp sẵn micro, camera, chia sẻ màn hình, thông báo cho đúng địa chỉ NEXA (kể cả địa chỉ `http://` trong LAN — được coi là an toàn); chạy bằng quyền Administrator hoặc đẩy qua Group Policy/Intune. Có file gỡ.
3. **Địa chỉ HTTPS cố định** để trình duyệt nhớ lựa chọn (đừng dùng địa chỉ tunnel “nhanh” đổi liên tục).
4. **Nếu vẫn không có quyền**: cuộc gọi không còn bị chặn — người đó vẫn vào, nghe và xem người kia ở chế độ chỉ nghe/xem, bấm nút micro/camera khi muốn cấp quyền sau.


## 5. Danh sách tính năng

| Nhóm | Tính năng |
|---|---|
| Nhắn tin | Chat cá nhân, nhóm (tới 1000+ thành viên, chỉnh được), trả lời trích dẫn, chuyển tiếp (tới 5 nơi), thu hồi, xoá phía tôi, thả cảm xúc (10 loại), nhắc tên @ / @Tất cả, ghim tối đa 5 tin, “đang soạn tin”, “đã xem”, tìm kiếm tin nhắn, cuộn nạp tin cũ, nhảy tới tin gốc |
| Nội dung | Ảnh (tự nén), video, tệp, tin nhắn thoại, vị trí (bản đồ OpenStreetMap, kéo/phóng to), bình chọn (1 hoặc nhiều đáp án), emoji, liên kết tự nhận diện, kéo-thả / dán ảnh từ clipboard |
| Chụp màn hình | Chọn màn hình/cửa sổ/tab → trình chỉnh sửa: bút, dạ quang, đường thẳng, mũi tên, hình chữ nhật/elip, chèn chữ, **làm mờ (mosaic) che thông tin**, cắt, xoay, hoàn tác/làm lại, lưu về máy; cũng dùng để sửa ảnh trước khi gửi |
| Cuộc gọi | Thoại, video, gọi nhóm, chia sẻ màn hình, tắt mic/camera, chuông cuộc gọi đến, nhật ký cuộc gọi trong hội thoại, chọn thiết bị + thử micro |
| Danh bạ | Danh bạ toàn hệ thống, kết bạn / lời mời, chặn, hồ sơ, Cloud của tôi, ghim/tắt tiếng/ẩn/đánh dấu chưa đọc hội thoại, thư viện Ảnh-Video / File / Link của từng cuộc trò chuyện |
| Nhóm | Trưởng nhóm / phó nhóm, thêm-xoá thành viên, chuyển quyền, ảnh + tên + mô tả nhóm, “chỉ quản trị được nhắn”, giải tán |
| Cài đặt | Chung, Tài khoản & bảo mật (đổi mật khẩu, đăng xuất mọi thiết bị), Quyền riêng tư, Thông báo, Giao diện (sáng/tối, màu chủ đạo, cỡ chữ, hình nền), Tin nhắn, Quản lý dữ liệu (dung lượng, xoá tệp), Cuộc gọi |
| Quản trị | Giới hạn dung lượng/tệp, hạn mức từng người & toàn hệ thống, chế độ đăng ký (mở / mã mời / duyệt / đóng), tạo & nhập tài khoản hàng loạt, khoá / cấm chat / đặt lại mật khẩu, giám sát tải, nhật ký chống tấn công, thông báo toàn hệ thống |

**Giới hạn dung lượng:** tối đa mỗi tệp (mặc định 50 MB), hạn mức mỗi người (mặc định 1 GB), hạn mức toàn hệ thống (theo dung lượng Drive còn trống), tự xoá tệp đính kèm cũ hơn N ngày (tuỳ chọn) và tệp tải lên nhưng không gửi đi sau 6 giờ. Việc đặt chỗ dung lượng làm trước khi ghi nên tải song song cũng không vượt hạn mức.

---

## 6. Bảo vệ khỏi spam và tấn công

| Mối đe doạ | Biện pháp |
|---|---|
| Dò mật khẩu | Giới hạn theo IP và theo tài khoản, băm mật khẩu scrypt, hàng đợi băm giới hạn để không nghẽn CPU |
| Đăng ký hàng loạt (bot) | 5 tài khoản/giờ/IP, ô ẩn bẫy bot, tuỳ chọn mã mời / duyệt tay |
| Spam tin | Giới hạn tin/phút, phát hiện nội dung lặp, nhiều liên kết, gửi cùng nội dung cho nhiều người → tự khoá chat 2 → 10 → 60 → 360 phút; giới hạn số cuộc trò chuyện mới với người lạ |
| Bão yêu cầu | Token-bucket theo IP; vượt nhiều → IP bị chặn 10 phút; người khác không bị ảnh hưởng |
| Tải tệp độc hại / nhồi dung lượng | Từ chối ngay khi đọc header, tối đa 3 tải đồng thời/người và 40 toàn hệ thống, đặt chỗ hạn mức, kiểm tra “magic bytes” của ảnh, tệp phục vụ dạng tải về + CSP sandbox, hạn chót cho tải chậm |
| Slowloris / gói tin dị dạng | Hạn chót nhận header 20 giây, đọc nội dung 15 giây, giới hạn kích thước, JSON lồng sâu, header/URL quá dài |
| Giả mạo phiên, truy cập trái phép | Cookie HttpOnly + SameSite, token ký HMAC có phiên bản (thu hồi được), kiểm tra quyền thành viên ở mọi API và cả khi tải tệp, kiểm tra Origin (CSRF) |
| XSS, duyệt đường dẫn | Giao diện chỉ dùng `textContent`, CSP chặn script ngoài, loại ký tự điều khiển/đảo chiều, không phục vụ tệp ngoài `public/` |
| Chiếm kết nối realtime | Tối đa 6 thiết bị/người, giới hạn kết nối theo IP, ngắt máy khách quá chậm |

Nhật ký các sự kiện này xem ở *Cài đặt → Nhật ký chống spam* và trong thư mục `logs/`.

---

## 7. Kết quả kiểm thử (chạy trong môi trường thử nghiệm 2 nhân CPU chia sẻ với 1000 client giả lập — rất khắc nghiệt hơn máy thật)

Chi tiết: `tests/ketqua-tai-1000.txt`, `tests/ketqua-tan-cong.txt`.

**1000 người dùng đồng thời** (`N=1000 node tests/load.js`): 1000/1000 online, 174 tin/giây (mỗi người ~1 tin/6 giây; 65% nhắn riêng, 34% nhóm ~20 người, 1% nhóm toàn công ty 1000 người) → ~2700 lượt giao tin/giây.
* Giao tin đủ **100%** (159 876/159 876), độ trễ gửi→nhận: p50 8 ms, p95 39 ms, lớn nhất 80 ms.
* Độ trễ vòng lặp máy chủ tối đa 22 ms (ngưỡng nghẽn là 200 ms), CPU trung bình ~13% của 1 nhân, RAM ~250 MB.
* Mở app đồng thời 1000 người: p95 ≈ 1,8 s. Khởi động lại máy chủ với 1000 tài khoản: 1,8 s; 1000 người kết nối lại cùng lúc sau khi máy chủ khởi động lại: xong trong 5,5 s, không lỗi.
* Điểm nặng nhất: **đăng nhập cùng lúc cả 1000 người** (băm mật khẩu tốn CPU) mất ~9–10 giây cho người cuối hàng trong môi trường thử; chỉ xảy ra một lần vì phiên đăng nhập kéo dài 30 ngày. Trên máy thật nhiều nhân sẽ nhanh hơn.

**Tấn công / spam** (`node tests/attack.js`): 90/90 kịch bản bị chặn (12 nhóm: dò mật khẩu, đăng ký bot, spam, tải tệp, slowloris, giả token, IDOR, XSS/đường dẫn, kết nối realtime, bão yêu cầu, lạm dụng tính năng, nhật ký). Trong đợt tấn công, người dùng bình thường vẫn được phục vụ (1 ms) và độ trễ máy chủ tối đa 69 ms.

**Chức năng:** `tests/convstore.js` (kho tin nhắn), `tests/e2e.js` (158 kiểm tra API + khởi động lại giữ dữ liệu), `tests/failover.js` (dự phòng 2 máy), và hai bài trên **Chromium thật với camera/micro giả**: `tests/ui.py` (32 kiểm tra giao diện: nhắn tin, ảnh, trình sửa ảnh, chụp màn hình, vị trí, bình chọn, ghi âm, nhóm, gọi video, chia sẻ màn hình, cài đặt, giới hạn dung lượng), `tests/call.py` (gọi thoại/video lặp lại 4 lần + gọi nhóm 3 người). Chạy: `node tests/e2e.js`; `python3 tests/ui.py` (cần `pip install playwright pillow`).

> Đã chạy lại bài tải 1000 người **sau khi bật fsync/fdatasync**: 10.389 tin, 181.721/181.721 lượt giao (100%), độ trễ giao tin p50 11 ms / p99 60 ms, vòng lặp sự kiện tối đa 78 ms, CPU ~15% một nhân — không khác đáng kể so với trước (chi tiết `tests/ketqua-tai-1000.txt`).

## 8. Giới hạn đã biết (nói thẳng)

**Đã khắc phục ở bản này:**
* ✅ **Thông báo khi đã đóng trình duyệt:** có Web Push (VAPID + mã hoá RFC 8291, không cần thư viện). Bật ở *Cài đặt → Thông báo → Thông báo khi đã đóng ứng dụng* (cần HTTPS; iPhone cần thêm vào Màn hình chính, iOS 16.4+). Chỉ báo cho người đang offline, không báo hội thoại đã tắt tiếng, có báo cuộc gọi đến, tự xoá thiết bị khi dịch vụ push báo hết hạn, chống SSRF (chỉ gửi tới máy chủ push của Google/Mozilla/Apple/Microsoft). Admin tắt/bật ở *Giới hạn và đăng ký*.
* ✅ **Mất tin khi mất điện đột ngột:** mọi lần ghi đều `fsync` (tệp JSON) / `fdatasync` (nhật ký tin nhắn) — cửa sổ rủi ro chỉ còn ≤ ~300 ms thay vì “cho tới khi hệ điều hành xả bộ đệm”.
* ✅ **Tìm kiếm toàn cục** quét **tất cả** hội thoại của bạn (ngân sách 3 giây; nếu hết giờ sẽ báo “đã tìm X/Y hội thoại”), thay vì chỉ 30 hội thoại gần nhất.
* ✅ **Mất dữ liệu khi đồng bộ Drive:** xem mục 13 (dữ liệu chạy ở ổ nội bộ, bản sao lưu mới lên Drive).
* ✅ **Gọi khi chưa cấp quyền micro/camera:** vẫn vào được cuộc gọi, nghe/xem người kia, cấp quyền sau bằng nút micro. Xem mục 4.

**Còn tồn tại (không sửa được bằng phần mềm đơn lẻ, hoặc ngoài phạm vi):**
* Máy chủ vẫn là **một tiến trình Node trên một máy** tại một thời điểm (có dự phòng, không chạy song song). Phù hợp tới vài nghìn người; hơn nữa cần thiết kế lại (CSDL + nhiều tiến trình).
* Trình duyệt **bắt buộc** hỏi quyền micro/camera ở lần đầu: không web nào được tự bỏ qua. Cách không phải bấm: ứng dụng .exe/.apk/.ipa (tự cấp), chính sách Chrome/Edge (mục 4), hoặc để trình duyệt nhớ lựa chọn trên một địa chỉ HTTPS cố định.
* Gọi video là P2P: nhóm lớn hơn ~6 người sẽ nặng máy người dùng (không dùng SFU). Khác mạng nghiêm ngặt cần TURN (mục 4).
* Bản đồ dùng ô ảnh OpenStreetMap từ Internet; dùng nhiều nên đổi `mapTileUrl`.
* Chưa có: sticker/GIF, hội nghị lớn, tin nhắn tự huỷ, mã hoá đầu-cuối (quản trị viên đọc được nội dung), đồng bộ danh bạ, nhắc hẹn. Ứng dụng Android/iOS đóng gói (Capacitor) chưa có thông báo đẩy gốc (cần tài khoản Firebase/APNs của bạn); trình duyệt/PWA thì có.
* Địa chỉ Cloudflare Tunnel “nhanh” (trycloudflare.com) **đổi mỗi lần chạy lại**; muốn địa chỉ cố định cần tên miền trong tài khoản Cloudflare (mục 15).
* Bản .exe/.apk/.ipa, đường chạy thật qua Cloudflare/Google Drive không kiểm thử được trong môi trường phát triển này (chỉ kiểm thử bằng cloudflared giả / dịch vụ push giả); hãy thử thật trước khi triển khai.
* Quản trị viên xem được nhật ký hệ thống và có thể khoá/xoá tài khoản (nêu trong chính sách quyền riêng tư).

## 9. Cấu hình `config.json`

| Khoá | Ý nghĩa |
|---|---|
| `port` | Cổng (mặc định 3000; biến môi trường `PORT`) |
| `dataDir` | Thư mục dữ liệu trong Google Drive (biến môi trường `DATA_DIR`) |
| `https` | `true` (chứng chỉ tự ký trong `certs/`) hoặc `{"key":"…","cert":"…"}` |
| `trustProxy` | `true` khi đứng sau Cloudflare / Nginx / Tailscale Funnel |
| `iceServers`, `turn` | Máy chủ STUN/TURN cho cuộc gọi |
| `leaseSeconds` | Thời gian máy dự phòng chờ trước khi tiếp quản (mặc định 90) |
| `sessionDays` | Thời hạn phiên đăng nhập (mặc định 30) |
| `mapTileUrl` | Nguồn ô bản đồ |
| `contactEmail` | Email liên hệ hiện trên trang /privacy.html (bắt buộc khi lên cửa hàng) |
| `downloadsDir` | Thư mục chứa file cài đặt cho nhân viên tải (mặc định `downloads`) |

Giới hạn dung lượng, đăng ký, số thành viên, tốc độ tin nhắn, cuộc gọi chỉnh trực tiếp trong giao diện quản trị (lưu ở `settings.json` trong thư mục dữ liệu).

## 10. Sao lưu, khôi phục, gỡ sự cố

* **Sao lưu / khôi phục / đổi thư mục dữ liệu:** *Cài đặt → Quản trị → Dữ liệu và sao lưu* (mục 15). Có sao lưu tự động theo lịch, kiểm tra CRC trước khi khôi phục và luôn giữ lại bản dữ liệu cũ.
* **Chuyển sang máy khác:** cài Node.js, chép thư mục chương trình, trỏ `dataDir` tới cùng thư mục Drive, chạy. (Tắt máy cũ hoặc để chế độ dự phòng.)
* **Quên mật khẩu quản trị:** quản trị viên khác vào *Quản lý người dùng → Đặt lại mật khẩu*. Nếu mất hết quyền quản trị: dừng máy chủ, chạy `node tools/reset-admin.js tên_đăng_nhập mật_khẩu_mới` (đặt lại mật khẩu và cấp quyền quản trị cho tài khoản đó), rồi chạy lại máy chủ.
* **“Máy khác đang là máy chủ”:** chờ ~90 giây hoặc chạy với biến môi trường `FORCE=1` để giành quyền (chỉ khi chắc chắn máy kia đã tắt).
* **Không gọi được video:** kiểm tra đang dùng HTTPS; cấp quyền camera/micro; mạng khác nhau → cấu hình TURN.
* **Muốn kiểm tra tải của chính bạn:** `N=1000 DURATION=60 node tests/load.js` (chạy trên máy khác với máy chủ để có số liệu thật).

## 11. Truy cập web / di động và đóng gói ứng dụng (.exe, Android, iOS)

**Công cụ cho quản trị viên:** Cài đặt → *Quản trị hệ thống* → **Truy cập web / di động**:
- ô **Địa chỉ công khai** (HTTPS) + **mã QR** để nhân viên quét bằng điện thoại;
- **Link mời đăng ký** (có hạn dùng + số lượt, QR riêng) — dùng được kể cả khi hệ thống đang ở chế độ đóng / cần duyệt;
- thư mục `downloads/`: chép file `.exe` / `.apk` vào đây, nhân viên tải trong Cài đặt → **Cài ứng dụng**.

**Cài như ứng dụng, không cần cửa hàng (PWA):** Android/Chrome "Cài đặt ứng dụng"; iPhone/Safari "Thêm vào Màn hình chính"; Windows/macOS Chrome/Edge biểu tượng cài đặt ở thanh địa chỉ.

**Đóng gói** nằm trong thư mục `apps/` — đọc `apps/HUONG-DAN-DONG-GOI.md`:
- `apps/desktop` (Electron) → `build-windows.bat` tạo bộ cài `.exe`;
- `apps/mobile` (Capacitor 8) → dự án Android Studio + Xcode dựng sẵn (Android 16/API 36); `build-android.bat` tạo `.aab` (Google Play) và `.apk`; `build-ios.sh` trên Mac tạo `.ipa`;
- `apps/store` → mô tả, Data safety, ghi chú cho người duyệt Apple, danh sách ảnh chụp màn hình; trang `/privacy.html` (chính sách quyền riêng tư + hướng dẫn xoá tài khoản) do chính server cung cấp;
- tài khoản có thể **tự xoá trong app** (Cài đặt → Tài khoản và bảo mật) như hai cửa hàng yêu cầu.

Đã kiểm thử tự động: `tests/access.js` (40 kiểm tra: link mời, tải tệp, chống path traversal, xoá tài khoản, PWA) và `tests/ui_access.py` (14 kiểm tra trên Chromium: QR, link mời, trang Cài ứng dụng, service worker). Các bản `.exe`/`.apk`/`.ipa` thực tế chưa được dựng thử trong môi trường phát triển (thiếu Windows, Android SDK, Mac) — hãy chạy các script build trên máy của bạn.

Sự thật cần biết: app điện thoại cần địa chỉ **HTTPS hợp lệ**; chưa có thông báo đẩy khi app tắt hẳn; chia sẻ màn hình chỉ có trên máy tính; Apple có thể từ chối app dạng "vỏ web"; phải dùng tài khoản nhà phát triển và khoá ký của riêng bạn (Google Play 25 USD một lần, Apple 99 USD/năm, iOS cần Mac).

## 12. Đổi tên và các cập nhật mới (NEXA)

- **Tên mới: NEXA**, logo ba lá may mắn (cỏ ba lá), màu chủ đạo xanh lá (vẫn đổi được ở Cài đặt → Giao diện). Nếu bạn đã có `config.json` cũ, hãy sửa `"appName": "NEXA"`.
- **Nhật ký chống spam:** mỗi sự kiện là một dòng; **bấm vào dòng để mở ngay chi tiết** — thời gian, tài khoản, IP, loại thiết bị, trình duyệt / hệ điều hành, User-Agent gốc, gợi ý xử lý — kèm nút **Chặn IP 1 giờ / 24 giờ, Gỡ chặn, Cấm chat, Khoá tài khoản**. Có lọc theo loại / mức độ, tìm kiếm, tự làm mới 5 giây, thanh hiển thị các IP đang bị chặn.
- **Phân quyền thiết bị theo từng người:** Quản lý người dùng → ⋯ → *Thiết bị được dùng và dung lượng…* → bật/tắt **Ứng dụng máy tính (.exe)**, **Trình duyệt web**, **Thiết bị di động**. Tắt loại nào thì người đó bị đăng xuất khỏi loại đó ngay và không đăng nhập lại được. Nhận diện theo User-Agent (app .exe và app di động tự gắn nhãn `ZolaDesktop` / `ZolaMobile`), nên đây là chính sách quản lý chứ không phải rào bảo mật tuyệt đối; **cần đóng gói lại .exe / app di động bằng bản mới** thì mới được nhận diện đúng (bản cũ sẽ bị coi là "trình duyệt web").
- **Dung lượng riêng từng người:** cùng hộp thoại trên, đặt hạn mức riêng (MB, 0 = không giới hạn) hoặc dùng mặc định; bảng người dùng hiện "đã dùng / hạn mức".
- **Chụp màn hình kiểu Zalo:** bấm nút chụp → **kéo chuột chọn vùng** (hiện kích thước, Enter để chụp, Esc để huỷ, có nút "Toàn màn hình") → mở trình chỉnh sửa → gửi. Trong ứng dụng .exe, cửa sổ tự ẩn rồi chụp thẳng màn hình, không cần hộp thoại chia sẻ.
- **Hình nền tuỳ chọn:** Cài đặt → Giao diện → *Chọn ảnh từ máy tính…* (ảnh tự thu nhỏ, chỉ áp dụng cho tài khoản của bạn).
- Kiểm thử: `tests/access.js` 64/64, `tests/ui_access.py` 20/20, `tests/ui.py` 34/34, e2e 158, tấn công 90/90.

## 13. Dữ liệu trên Google Drive + truy cập từ bất cứ đâu (thiết kế mới, an toàn hơn)

**Vấn đề của cách cũ:** để thư mục dữ liệu *đang chạy* nằm thẳng trong Google Drive thì Drive đồng bộ từng tệp một, trong lúc NEXA vẫn đang ghi liên tục. Khi hai máy cùng đụng vào, hoặc mạng chập chờn, Drive có thể tạo bản “xung đột” hoặc đồng bộ dở dang → mất / lệch tin nhắn. Link chia sẻ thư mục Drive (`drive.google.com/drive/folders/...`) cũng **không phải một địa chỉ để chương trình đọc/ghi**: nó chỉ là trang web để người xem.

**Cách làm hiện tại (khuyên dùng):**
1. **Dữ liệu chạy** nằm ở ổ cứng nội bộ của máy chủ (mặc định `./data`; đổi bằng *Cài đặt → Dữ liệu và sao lưu → Đổi thư mục…*).
2. **Bản sao lưu** (mỗi bản là một tệp `.zip` mới, không bao giờ ghi đè) được lưu vào thư mục **Google Drive for Desktop** — Drive chỉ đồng bộ tệp đã hoàn chỉnh nên không thể làm hỏng. Tệp tải lên (ảnh, tài liệu) được chép *tăng dần* sang `<thư mục sao lưu>/uploads`.
3. Hỏng máy / hỏng ổ: cài NEXA trên máy khác, tải thư mục Drive về, *Dữ liệu và sao lưu → Khôi phục từ thư mục khác*. Mất tối đa khoảng thời gian giữa 2 lần sao lưu (mặc định tự động mỗi ngày; chỉnh xuống mỗi giờ nếu cần).
4. Truy cập từ bất cứ đâu: xem mục 15 (Cloudflare Tunnel tích hợp sẵn).

**Bảo mật thư mục Drive:** hãy đặt quyền chia sẻ là **“Hạn chế” (Restricted)**. Thư mục chứa bản sao lưu có toàn bộ tin nhắn, tài khoản (đã băm mật khẩu), khoá ký đăng nhập `secret.key`. Nếu để “Bất kỳ ai có đường liên kết đều là Người chỉnh sửa”, **ai có link cũng đọc được và sửa được** — kể cả sửa mã chương trình nếu bạn để cả thư mục chương trình ở đó.

Cũng vẫn dùng được cách cũ (đặt `dataDir` trong thư mục Drive, chế độ Mirror, một máy chạy + một máy dự phòng) nếu bạn chấp nhận rủi ro trên; không còn được khuyên dùng.

## 14. Kiểm soát tệp của người dùng (chống gửi dữ liệu ra ngoài)

Cài đặt → Quản trị hệ thống → **Kiểm soát tệp** (3 tab):
- **Chính sách:** danh sách cấm đuôi tệp (mặc định chặn exe, msi, bat, cmd, scr, ps1, vbs, jar, dll, apk, js…), danh sách *chỉ cho phép* (ví dụ chỉ pdf, docx, xlsx, png, jpg), chặn tệp nén có mật khẩu, giới hạn dung lượng gửi mỗi người / 24 giờ, ngưỡng cảnh báo tải hàng loạt. Hệ thống kiểm tra cả **nội dung thật** (file exe đổi tên thành .pdf vẫn bị chặn).
- **Nhật ký tệp:** ai tải lên / xem / tải tài liệu về / xoá tệp gì, lúc nào, từ IP và thiết bị nào; các lần bị chặn. Bấm vào dòng để xem chi tiết. Tải hàng loạt bất thường (mặc định > 40 tài liệu/giờ) tự đưa lên *Nhật ký chống spam* mức Nghiêm trọng.
- **Tất cả tệp:** duyệt toàn bộ tệp đã tải lên (lọc theo loại, tìm theo tên/người), biết tệp đã gửi vào cuộc trò chuyện nào, **mở** hoặc **xoá** ngay. Mọi lần admin mở/xoá đều được ghi nhật ký.
- **Theo từng người:** Quản lý người dùng → ⋯ → *Thiết bị được dùng và dung lượng…* → tắt **Được gửi tệp** hoặc **Được tải tệp về máy** (tài liệu/tệp nén bị chặn; ảnh, video chỉ xem trong ứng dụng).

**Phải tuân thủ để các kiểm soát có tác dụng:**
- **Không chia sẻ thư mục dữ liệu trên Google Drive** cho bất kỳ ai khác (kể cả nhân viên IT), và dùng tài khoản Google riêng của tổ chức có bật xác minh 2 bước. Ai mở được thư mục này có thể đọc tệp trực tiếp, bỏ qua mọi kiểm soát.
- Chính sách quyền riêng tư (/privacy.html) đã ghi rõ quản trị viên có thể kiểm tra tệp; hãy thông báo cho nhân viên theo quy định pháp luật và nội quy của bạn.

**Không làm được (nói thẳng):** không thể ngăn người dùng chụp ảnh màn hình, chép chữ, quay màn hình hay chụp bằng điện thoại khác; ảnh/video "chỉ xem" vẫn lưu được bằng cách chụp màn hình; hệ thống không đọc nội dung tài liệu để phát hiện thông tin nhạy cảm. Muốn kiểm soát ở mức thiết bị cần phần mềm quản lý thiết bị (MDM) hoặc chống thất thoát dữ liệu (DLP) của doanh nghiệp. Kiểm thử: `tests/filectl.js` 42 kiểm tra.

## 15. Công cụ dữ liệu, Cloudflare Tunnel, chụp màn hình, thông báo đẩy

**Dữ liệu và sao lưu** (Cài đặt → Quản trị hệ thống → *Dữ liệu và sao lưu*):
- **Chọn đường dẫn chứa database:** nút *Đổi thư mục…* mở hộp duyệt thư mục trên máy chủ. Chọn thư mục trống → chép dữ liệu sang (có đối chiếu số tệp/dung lượng), ghi vào `location.json` rồi tự khởi động lại; chọn thư mục đã có dữ liệu NEXA → “dùng dữ liệu có sẵn”. Dữ liệu cũ **không bị xoá**. Cần nhập lại mật khẩu quản trị. (Thứ tự ưu tiên: biến môi trường `DATA_DIR` > `location.json` > `config.json`.) Tự khởi động lại cần chạy bằng `start.bat` / `start.sh` (đã đặt `ZOLA_SUPERVISED=1`); nếu chạy kiểu khác, máy chủ dừng và bạn chạy lại.
- **Sao lưu:** chọn thư mục lưu (ví dụ thư mục Google Drive đồng bộ, `G:\My Drive\ZolaBackup`), lịch tự động (giờ/ngày/tuần), số bản giữ lại, và cách xử lý tệp tải lên (chép tăng dần / gói trong zip ≤ 4 GB / bỏ qua). *Sao lưu ngay* để tạo bản tức thì. Bản `.zip` tạo bằng ZIP chuẩn, mở được bằng mọi phần mềm.
- **Khôi phục:** chọn bản sao lưu → nhập mật khẩu quản trị. Hệ thống kiểm tra CRC từng tệp (bản hỏng / bị cắt / chứa đường dẫn độc `../` bị từ chối trước khi đụng tới dữ liệu), **tự sao lưu dữ liệu hiện tại** (`*-truoc.zip`), giữ dữ liệu cũ trong `_truoc-khoi-phuc-*`, rồi khởi động lại. Có thể khôi phục từ thư mục khác (chuyển máy chủ).

**Cloudflare Tunnel** (Cài đặt → *Truy cập web / di động*): đưa hệ thống ra Internet bằng HTTPS, không mở cổng modem.
- *Chế độ nhanh*: không cần tài khoản/tên miền; nhận địa chỉ `https://….trycloudflare.com` và tự điền vào “Địa chỉ công khai”. **Địa chỉ đổi mỗi lần tunnel chạy lại** → chỉ để thử nghiệm.
- *Chế độ cố định*: cần **tên miền thuộc tài khoản Cloudflare** (Cloudflare không cấp địa chỉ cố định nếu không có tên miền). Tạo tunnel trong Zero Trust → Networks → Tunnels, thêm Public hostname trỏ tới `http://localhost:<cổng>`, dán token vào ô. Địa chỉ không đổi.
- Nút *Tải cloudflared* lấy bản chính thức từ GitHub vào thư mục `tools/` (hoặc đặt biến `CLOUDFLARED`). Đã bật tunnel thì tự chạy lại khi khởi động máy chủ, tự nối lại khi rớt. IP thật của người dùng được đọc từ Cloudflare *chỉ khi* kết nối đến từ chính máy chủ (chế độ `trustProxy: "auto"`).
- Cloudflare gói miễn phí giới hạn **100 MB mỗi yêu cầu** (tệp lớn hơn qua tunnel sẽ lỗi).

**Chụp màn hình kiểu Zalo:** nút chia đôi, mũi tên mở menu: *Chụp kèm với cửa sổ NEXA (Alt+Ctrl+S)* · *Chụp KHÔNG kèm cửa sổ NEXA (Ctrl+Alt+A)*; dấu ✓ là chế độ mặc định (nhớ lại cho lần sau, đổi được trong Cài đặt chung). Bản .exe: phím tắt toàn hệ thống (cả khi cửa sổ thu nhỏ), ẩn/hiện cửa sổ đúng chế độ, kéo chọn vùng trên toàn màn hình. Bản web: Chrome/Edge ẩn hoặc hiện tab hiện tại trong hộp chọn; phím tắt hoạt động khi đang ở trang chat.

## 16. Công cụ AI tích hợp (ChatGPT / Gemini / Claude dùng chung, mỗi người một hồ sơ)

Biểu tượng ✨ ở thanh bên mở **Trợ lý AI**. Quản trị viên cấu hình ở *Cài đặt → Quản trị → Trợ lý AI*.

**Cách hoạt động:** quản trị viên nhập một hoặc nhiều *tài khoản AI* bằng **khoá API chính thức**:
- OpenAI (ChatGPT): platform.openai.com/api-keys — hoặc bất kỳ máy chủ tương thích OpenAI (OpenRouter, Groq, Azure, Ollama…) bằng ô “Địa chỉ máy chủ”.
- Google Gemini: aistudio.google.com/apikey · Anthropic Claude: console.anthropic.com.

> **Vì sao không nhập “email + mật khẩu ChatGPT/Gemini có phí”:** gói ChatGPT Plus/Gemini Advanced cá nhân không có cổng chính thức cho phần mềm khác, và điều khoản của nhà cung cấp cấm chia sẻ tài khoản. Cách đúng để cả nhóm dùng chung là **khoá API** (tính tiền theo lượt dùng, có hạn mức) hoặc gói Team/Enterprise của nhà cung cấp rồi lấy khoá API của gói đó. NEXA không lưu hay dùng mật khẩu đăng nhập của bất kỳ dịch vụ AI nào.

**Linh động đổi tài khoản:** thêm/sửa/thay khoá/tắt/xoá bất cứ lúc nào (có hiệu lực ngay, không khởi động lại); đặt tài khoản **mặc định**; kéo thứ tự = thứ tự **dự phòng tự động** (khoá hết hạn mức hay nhà cung cấp lỗi 401/402/403/429/5xx thì tự chuyển sang tài khoản kế tiếp); giới hạn một tài khoản chỉ cho một số người dùng; nút *Thử kết nối* và *Lấy danh sách mô hình*.

**Mỗi người một hồ sơ, không ảnh hưởng nhau:** mỗi thành viên có lịch sử hội thoại riêng, “Hồ sơ AI của tôi” (hướng dẫn riêng cho AI), hạn mức riêng (lượt/ngày, token/ngày, độ dài câu trả lời) và có thể chọn tài khoản + mô hình mình dùng. Dữ liệu mỗi người nằm trong `ai/chats/<mã người>/`; mọi API chỉ chạm tới dữ liệu của chính người gọi (đã kiểm thử chống đọc/xoá chéo và path traversal).

**Bảo mật:** khoá API mã hoá AES-256-GCM khi lưu (khoá dẫn xuất từ `secret.key`, nằm trong bản sao lưu nên khôi phục được), không bao giờ trả về trình duyệt, che khoá trong thông báo lỗi. Quản trị viên chỉ thấy số lượt/token từng người, không có màn hình đọc nội dung chat AI của người khác — nhưng nội dung lưu **không mã hoá** trong thư mục dữ liệu và được gửi tới nhà cung cấp AI; hãy thông báo nhân viên và dặn không nhập bí mật vào AI. Có thể chặn từng người dùng AI.

**Giới hạn:** hiện chỉ văn bản (chưa gửi ảnh/tệp cho AI); mỗi hội thoại tối đa 400 tin; chi phí do nhà cung cấp tính theo khoá của bạn (nên đặt hạn mức chi tiêu ở trang nhà cung cấp). Đã kiểm thử với nhà cung cấp giả cho cả 3 giao thức; chưa thử với khoá thật vì môi trường phát triển này không có khoá.

## 17. Chạy giao diện trên GitHub Pages (chế độ "máy chủ từ xa")

**Sự thật cần biết trước:** GitHub Pages chỉ host được *trang tĩnh*. NEXA có phần máy chủ (tin nhắn, tệp, gọi, đồng bộ) nên **vẫn phải có một máy chủ NEXA chạy HTTPS** (máy của bạn + Cloudflare Tunnel, VPS, v.v.). GitHub Pages chỉ phục vụ *giao diện*; dữ liệu chat không nằm trên GitHub.

Cách hoạt động: trang trên `https://tenban.github.io/nexa/` gọi API sang máy chủ NEXA của bạn bằng token Bearer (cookie bên thứ ba bị Safari/Chrome chặn nên không dùng cookie), tin nhắn thời gian thực qua luồng `fetch` có header, còn ảnh/video/tệp dùng "token tệp" ngắn hạn (12 giờ, chỉ xem được `/files` và `/dl`, không gọi được API).

Các bước:
1. Đưa mã lên GitHub như hướng dẫn trước (repo có sẵn `.github/workflows/pages.yml`).
2. Repo → **Settings → Pages → Source: GitHub Actions**.
3. (Tuỳ chọn) Repo → Settings → Secrets and variables → Actions → **Variables** → thêm `NEXA_SERVER` = `https://chat.congty.com` để mọi người khỏi phải nhập địa chỉ. Bỏ trống = trang tự hỏi địa chỉ máy chủ.
4. Push lên nhánh `main` → Actions tự build và đăng. Trang ở `https://<tên-bạn>.github.io/<tên-repo>/`.
5. **Trên máy chủ NEXA** (đăng nhập admin): Cài đặt → Truy cập web / di động → ô **"Trang web được phép dùng máy chủ này"** → điền `https://<tên-bạn>.github.io` (chỉ tên miền, không có `/tên-repo`) → Lưu. Hoặc đặt biến môi trường `NEXA_ORIGINS=https://tenban.github.io` khi chạy máy chủ.
6. Máy chủ phải là **HTTPS** (trang HTTPS không gọi được HTTP — "mixed content"). Dùng Cloudflare Tunnel (Cài đặt → Truy cập → Cloudflare Tunnel) là đủ.

Tự build thủ công: `node tools/build-static.js --server https://chat.congty.com --out dist` rồi đưa `dist/` lên bất kỳ hosting tĩnh nào (Netlify, Cloudflare Pages…). Bản `dist/` đã có `.nojekyll`, `404.html`, CSP, đường dẫn tương đối nên chạy được cả trong thư mục con của GitHub Pages.

Giới hạn: đăng nhập lưu token trong trình duyệt (xoá khi đăng xuất / đổi mật khẩu / "Đăng xuất mọi thiết bị"); không có chia sẻ cookie giữa trang GitHub Pages và máy chủ. Kiểm thử: `node tests/remote.js` (CORS, Bearer, token tệp, SSE) và `python3 tests/ui_remote.py` (trình duyệt thật, hai địa chỉ khác nhau).

## 18. Phát hành Google Play / App Store

Xem `apps/HUONG-DAN-DONG-GOI.md` và **`apps/store/CHECKLIST-PHAT-HANH.md`**. Tóm tắt những gì bản này đã chuẩn bị:
- **Logo mới** (cỏ 3 lá + các nút kết nối): `public/icon.svg`; `python3 tools/make-icons.py` xuất toàn bộ icon web/Android/iOS/Windows, splash và ảnh đặc trưng Play 1024×500.
- **App di động đóng gói sẵn giao diện** (không còn là "vỏ web" tải trang từ xa), người dùng nhập địa chỉ máy chủ lần đầu hoặc bạn điền sẵn `serverUrl`.
- **Tuân thủ nội dung người dùng tạo ra:** Điều khoản `terms.html` + ô đồng ý khi đăng ký; **báo cáo** tin nhắn/người dùng + trang quản trị **Báo cáo vi phạm**; chặn người dùng; xoá tài khoản trong app + URL xoá trên web.
- **Quyền Android tối thiểu** (bỏ READ_MEDIA_*), tắt sao lưu đám mây và cleartext.
- **Giao diện điện thoại:** thanh điều hướng ở đáy, ẩn khi vào hội thoại; ảnh chụp mẫu `python3 tools/make-store-shots.py`.
- Việc bạn phải tự làm: appId riêng, tài khoản nhà phát triển, ký app, tài khoản demo cho người duyệt, thông báo đẩy FCM/APNs (chưa có), build iOS cần Mac.
