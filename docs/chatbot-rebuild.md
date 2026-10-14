# Chatbot xây lại — Bản dễ đọc để bạn chốt

> Trạng thái: ĐANG LẬP KẾ HOẠCH + code dần theo task, file spec này từng bị mất nên viết lại đầy đủ.

## Nói 1 câu cho rõ

Đập bỏ code chatbot hiện tại (đang chắp vá 2 đường dữ liệu), xây lại gọn 1 đường duy nhất, giữ nguyên tính năng bạn đã duyệt, tốn ít lượt Firebase nhất có thể.

## Giữ lại gì, bỏ gì

- Giữ: gửi tin hiện ngay, đang trả lời, nhiều đoạn chat, làm lại, sửa kiểu lấy lại câu cũ, chép, dòng suy nghĩ, chấm đỏ, nút xuống dưới, màn hình trống, đăng nhập Google.
- Bỏ hẳn: nút đọc to, nút thích/không thích, ô chọn model phía user, đường tin luồng cũ, chấm trạng thái trang trí.
- Chưa làm vội: chữ chảy từng từ, gửi ảnh bài tập.

## Tiền Firebase tính thế nào (free/ngày: 50K đọc, 20K ghi)

- 1 câu hỏi = 3 lượt ghi. 20.000 ÷ 3 ≈ 6.600 câu/ngày cả hệ thống.
- Mở khung lần đầu tốn tối đa 50 lượt đọc (có cache máy + localStorage nên các lần sau chỉ vài lượt).
- Đắt nhất là Xóa đoạn (1 lượt/tin) nên đã có bấm 2 lần xác nhận.

## Đã chốt với bạn

1. Tên đoạn theo câu hỏi đầu ✅
2. Ẩn số quota, hết lượt mới báo bản free đã hết ✅
3. Toggle Nhớ hội thoại mặc định tắt (bật gửi kèm 10 tin) ✅
4. Xóa đoạn là mất luôn, không thùng rác ✅
5. Acc mới thấy màn hình trống + gợi ý ✅
6. Bạn tự publish Rules + deploy Worker ✅
7. Model free bàn to: Qwen3-30B, Sea-Lion 27B, GPT-OSS 20B, Llama 70B, Gemini Flash + OpenRouter lọc context ≥ 32K, bỏ model Alpha ✅
8. Admin xếp thứ tự đường gọi (tối đa 5, thử từ trên xuống), Worker chạy theo cấu hình ✅

## Việc đã làm trong code (chờ bạn deploy mới có tác dụng)

- Rules 1 đường sessions duy nhất (đọc/tạo/sửa/xóa chính chủ).
- Khung chat tách `components/` + `hooks/` + `utils/` theo chuẩn repo.
- Cache tin theo phiên, toggle Nhớ hội thoại, markdown + paste markdown vào take note.
- Worker: bảng `PROVIDERS` + chạy chung `runProvider`, 4 quy tắc trả lời, cấu hình chain trong KV.
- Trang admin: nền sáng full màn hình, hàng số hero, card xếp thứ tự đường gọi, dùng thử theo chain.

## Chưa deploy (bạn bấm tay)

- Publish `firestore.rules` trên Firebase console.
- Deploy `workers/chat-proxy/worker.js` trên Cloudflare.
- Test acc mới: không đỏ console, gửi/làm lại/tạo/xóa/chuyển đoạn đều chạy.

## Để dành sau này (chỉ giữ cửa, chưa code)

1. **Chữ chảy từng từ**: mọi gọi API qua 1 hàm `callChatApi`, sau thay ruột là xong.
2. **Gửi ảnh bài tập**: cần upload R2 + model đọc ảnh + chỗ gắn ảnh trong tin nhắn.
