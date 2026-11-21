# Danh mục Model & Đặc tính kỹ thuật MộtAPI (motapis.com)

> Tài liệu tham chiếu cho AI Agent và nhà phát triển dự án ZenStudy (Chat V2).  
> Cập nhật: Tháng 11/2026. Nguồn: Đối chiếu tài liệu kỹ thuật chính thức của nhà sản xuất (Anthropic, OpenAI, Google, DeepSeek, Alibaba, Zhipu, Moonshot, xAI) & catalog MộtAPI.

---

## 1. Tổng quan về MộtAPI (motapis.com)
- **Base URL:** `https://motapis.com/v1`
- **Định dạng tương thích:** Chuẩn OpenAI SDK (`/v1/chat/completions`) và Anthropic SDK (`/v1/messages`).
- **Quy mô:** 68 models từ 11 hãng AI hàng đầu.
- **Cơ chế tính phí:**
  - **Miễn phí (Free Tier):** 19 models (được cấp quota ~2 triệu token/ngày, ~20 triệu token/tháng).
  - **Trả phí (Pay-As-You-Go):** Tính theo đơn vị 1 triệu token (1M tokens), số dư ví không bao giờ hết hạn.
  - **Prompt Caching:** Nạp $\ge \$50$ giảm 50% phí đọc cache; nạp $\ge \$100$ giảm 90% phí đọc cache vĩnh viễn.

---

## 2. Bảng tổng hợp chi tiết 68 Models

### 2.1. Anthropic Claude (12 models)
*Đặc trưng:* Toàn bộ các dòng Claude 4.x và 5.x hiện đại của Anthropic đều hỗ trợ đa phương thức Vision (đọc ảnh, biểu đồ, tài liệu).*

| Model ID | Phân khúc (Tier) | Giá Input / 1M | Giá Output / 1M | Free? | Context Window | Hỗ trợ Vision (Đọc ảnh)? | Ghi chú kỹ thuật |
| :--- | :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| `claude-opus-5-5` | Flagship cao cấp | $2.40 | $12.00 | Không | 1,048,576 (1M) | ✅ **CÓ** | Tư duy phức tạp, phân tích biểu đồ & sơ đồ chuyên sâu |
| `claude-opus-5` | Flagship | $2.00 | $10.00 | Không | 1,048,576 (1M) | ✅ **CÓ** | Đa phương thức cao cấp |
| `claude-opus-4-8` | Flagship | $2.00 | $10.00 | Không | 1,048,576 (1M) | ✅ **CÓ** | Bản nâng cấp Opus 4 |
| `claude-opus-4-7` | Flagship | $2.00 | $10.00 | Không | 1,048,576 (1M) | ✅ **CÓ** | Bản ổn định doanh nghiệp |
| `claude-opus-4-6` | Flagship | $2.00 | $10.00 | Không | 1,048,576 (1M) | ✅ **CÓ** | Thế hệ Opus 4 |
| `claude-sonnet-5-5` | Standard (P/P vàng) | $1.20 | $6.00 | **CÓ** | 1,048,576 (1M) | ✅ **CÓ** | Flagship coding & giải bài tập, đọc ảnh/OCR tốt nhất |
| `claude-sonnet-5` | Standard | $1.20 | $6.00 | **CÓ** | 1,048,576 (1M) | ✅ **CÓ** | Đa phương thức tốc độ cao |
| `claude-sonnet-4-6` | Standard | $1.20 | $6.00 | **CÓ** | 1,048,576 (1M) | ✅ **CÓ** | Bản Sonnet 4 |
| `claude-haiku-5-5` | Economy (Siêu nhanh) | $0.40 | $2.00 | Không | 1,048,576 (1M) | ✅ **CÓ** | Nhẹ, phản hồi tức thì, đọc ảnh nhanh |
| `claude-haiku-4-5` | Economy | $0.40 | $2.00 | Không | 1,048,576 (1M) | ✅ **CÓ** | Chi phí rẻ cho tác vụ phụ |
| `claude-fable-5.1` | Flagship chuyên biệt | $5.00 | $25.00 | Không | 1,048,576 (1M) | ✅ **CÓ** | Model Vision sáng tạo hàng đầu của Anthropic |
| `claude-fable-5` | Flagship chuyên biệt | $2.00 | $10.00 | Không | 1,048,576 (1M) | ✅ **CÓ** | Hỗ trợ Vision và sáng tạo đa phương thức |

---

### 2.2. OpenAI GPT & Codex (17 models)
*Đặc trưng:* Các model GPT-6, GPT-5 đều hỗ trợ Vision native (bao gồm cả dòng Luna).*

| Model ID | Phân khúc (Tier) | Giá Input / 1M | Giá Output / 1M | Free? | Context Window | Hỗ trợ Vision (Đọc ảnh)? | Ghi chú kỹ thuật |
| :--- | :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| `gpt-6-astra` | Flagship tối cao | $3.00 | $15.00 | **CÓ** | 1,048,576 (1M) | ✅ **CÓ** | Model mạnh nhất của OpenAI thế hệ mới |
| `gpt-6-sol` | Flagship | $1.20 | $6.00 | **CÓ** | 1,048,576 (1M) | ✅ **CÓ** | Cân bằng hoàn hảo, đọc ảnh chuẩn xác |
| `gpt-6-luna` | Standard | $0.10 | $0.50 | **CÓ** | 1,048,576 (1M) | ✅ **CÓ** | Hỗ trợ Vision, chi phí đầu vào cực thấp |
| `gpt-6.1-sol` | Flagship | $1.20 | $6.00 | Không | 1,048,576 (1M) | ✅ **CÓ** | Bản cải tiến của dòng Sol 6 |
| `gpt-6.1-terra` | Standard | $0.70 | $3.50 | Không | 1,048,576 (1M) | ✅ **CÓ** | Suy luận nhanh, đọc ảnh rất tốt |
| `gpt-5.6-sol` | Flagship | $1.20 | $6.00 | **CÓ** | 1,048,576 (1M) | ✅ **CÓ** | Dòng 5.6 đa phương thức |
| `gpt-5.6-luna` | Standard | $1.20 | $6.00 | Không | 1,048,576 (1M) | ✅ **CÓ** | Hỗ trợ Vision đầy đủ |
| `gpt-5.6-terra` | Standard | $1.20 | $6.00 | Không | 1,048,576 (1M) | ✅ **CÓ** | Bản ổn định |
| `gpt-5.6` | Standard | $1.20 | $6.00 | Không | 1,048,576 (1M) | ✅ **CÓ** | Bản tiêu chuẩn |
| `gpt-5.5` | Standard | $1.20 | $6.00 | Không | 1,048,576 (1M) | ✅ **CÓ** | Bản tiền nhiệm |
| `gpt-5.4-mini` | Economy | $0.40 | $2.00 | Không | 409,600 (400k) | ✅ **CÓ** | Dòng mini gọn nhẹ, đọc ảnh tốt |
| `gpt-5.3-codex` | Standard | $1.20 | $6.00 | Không | 131,072 (128k) | ❌ Không | Chuyên viết mã nguồn (Code/Text-only) |
| `gpt-5.3-codex-spark` | Economy | $0.40 | $2.00 | Không | 131,072 (128k) | ❌ Không | Bản nhẹ cho lập trình (Code/Text-only) |
| `codex-auto-review` | Standard | $1.20 | $6.00 | Không | 131,072 (128k) | ❌ Không | Đánh giá & sửa mã tự động |
| `gpt-image-2` | Image | Theo lượt | Theo lượt | Không | - | 🖼️ Sinh ảnh | Mô hình tạo ảnh (Image Generation) |
| `gpt-image-2.5-flare` | Image | Theo lượt | Theo lượt | Không | - | 🖼️ Sinh ảnh | Chi tiết cực cao |
| `gpt-image-2.5-sunburst` | Image | Theo lượt | Theo lượt | Không | - | 🖼️ Sinh ảnh | Phong cách nghệ thuật ánh sáng |

---

### 2.3. Google Gemini (8 models)
*Đặc trưng:* Kiến trúc Native Multimodal từ lõi.*

| Model ID | Phân khúc (Tier) | Giá Input / 1M | Giá Output / 1M | Free? | Context Window | Hỗ trợ Vision (Đọc ảnh)? | Ghi chú kỹ thuật |
| :--- | :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| `gemini-4-argon` | Flagship | $1.20 | $6.00 | Không | 1,048,576 (1M) | ✅ **CÓ** | Thế hệ Gemini 4 đầu bảng |
| `gemini-3.8-flash` | Economy | $0.40 | $2.00 | Không | 1,048,576 (1M) | ✅ **CÓ** | Đọc ảnh, biểu đồ, tài liệu bài thi cực tốt |
| `gemini-3.7-flash` | Economy | $0.40 | $2.00 | Không | 1,048,576 (1M) | ✅ **CÓ** | Cân bằng tốc độ & chất lượng |
| `gemini-3.6-flash` | Economy | $0.40 | $2.00 | Không | 1,048,576 (1M) | ✅ **CÓ** | Bản 3.6 |
| `gemini-3.5-flash` | Economy | $0.40 | $2.00 | Không | 1,048,576 (1M) | ✅ **CÓ** | Bản tiêu chuẩn |
| `gemini-3.1-pro-preview` | Economy | $0.40 | $2.00 | Không | 1,048,576 (1M) | ✅ **CÓ** | Bản thử nghiệm Pro |
| `gemini-3.1-flash-lite-preview` | Economy | $0.40 | $2.00 | Không | 1,048,576 (1M) | ✅ **CÓ** | Siêu nhẹ |
| `gemini-2.5-flash` | Economy | $0.40 | $2.00 | Không | 1,048,576 (1M) | ✅ **CÓ** | Dòng 2.5 ổn định |

---

### 2.4. DeepSeek (6 models)
*Đặc trưng:* Dòng Flash (V4 Flash, V4.1 Flash) đều hỗ trợ đầu vào hình ảnh; dòng Pro chuyên sâu về Text reasoning.*

| Model ID | Phân khúc (Tier) | Giá Input / 1M | Giá Output / 1M | Free? | Context Window | Hỗ trợ Vision (Đọc ảnh)? | Ghi chú kỹ thuật |
| :--- | :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| `deepseek-v4-flash` | Economy | $0.07 | $0.14 | **CÓ** | 1,048,576 (1M) | ✅ **CÓ** | Tốc độ cao, hỗ trợ cả văn bản và hình ảnh |
| `DeepSeek-V4-Flash-0731` | Economy | $0.07 | $0.14 | **CÓ** | 1,048,576 (1M) | ✅ **CÓ** | Hỗ trợ đầu vào hình ảnh |
| `deepseek-v4.1-flash-1017` | Economy | $0.075 | $0.30 | **CÓ** | 1,048,576 (1M) | ✅ **CÓ** | Bản nâng cấp Vision tối ưu |
| `deepseek-v4.1-flash` | Economy | $0.075 | $0.30 | Không | 1,048,576 (1M) | ✅ **CÓ** | Dòng 4.1 chính thức có Vision |
| `deepseek-v4-pro` | Flagship | $0.22 | $0.44 | Không | 1,048,576 (1M) | ❌ Không | Chuyên suy luận và giải toán sâu (Text-only) |
| `deepseek-v4-pro-0813` | Flagship | $0.22 | $0.44 | Không | 1,048,576 (1M) | ❌ Không | Snapshot tháng 8 (Text-only) |

---

### 2.5. Alibaba Qwen (3 models)
*Đặc trưng:* Qwen Max sở hữu kiến trúc Omni/Multimodal hàng đầu.*

| Model ID | Phân khúc (Tier) | Giá Input / 1M | Giá Output / 1M | Free? | Context Window | Hỗ trợ Vision (Đọc ảnh)? | Ghi chú kỹ thuật |
| :--- | :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| `qwen3.8-max` | Flagship | $1.00 | $3.00 | **CÓ** | 1,048,576 (1M) | ✅ **CÓ** | Flagship mạnh nhất của Alibaba, đọc ảnh & tài liệu xuất sắc |
| `qwen3.7-max` | Flagship | $0.625 | $1.875 | Không | 1,048,576 (1M) | ✅ **CÓ** | Hỗ trợ Vision đa phương thức |
| `qwen3.7-plus` | Standard | $0.40 | $1.20 | Không | 1,048,576 (1M) | ❌ Không | Bản Text-only |

---

### 2.6. Zhipu AI GLM (4 models)
*Đặc trưng:* Chỉ bản Flash (`GLM-5.3 Flash`) mới hỗ trợ Vision; các bản tiêu chuẩn (`GLM-5.3`, `GLM-5.2`, `GLM-5.1`) là Text-only.*

| Model ID | Phân khúc (Tier) | Giá Input / 1M | Giá Output / 1M | Free? | Context Window | Hỗ trợ Vision (Đọc ảnh)? | Ghi chú kỹ thuật |
| :--- | :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| `glm-5.3-flash` | Economy | $0.075 | $0.25 | **CÓ** | 1,048,576 (1M) | ✅ **CÓ** | Bản Flash chuyên hỗ trợ Vision, giá siêu rẻ |
| `glm-5.3` | Flagship | $0.70 | $2.20 | Không | 1,048,576 (1M) | ❌ Không | Bản tiêu chuẩn chuyên suy luận chữ (Text-only) |
| `glm-5.2` | Flagship | $0.70 | $2.20 | Không | 1,048,576 (1M) | ❌ Không | Text-only |
| `glm-5.1` | Flagship | $0.70 | $2.20 | Không | 1,048,576 (1M) | ❌ Không | Text-only |

---

### 2.7. Moonshot AI Kimi (4 models)
*Đặc trưng:* Kimi Vision Model hỗ trợ khả năng hiểu hình ảnh gốc (native visual understanding) trên dòng K3 / K3.1-Pro.*

| Model ID | Phân khúc (Tier) | Giá Input / 1M | Giá Output / 1M | Free? | Context Window | Hỗ trợ Vision (Đọc ảnh)? | Ghi chú kỹ thuật |
| :--- | :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| `kimi-k3.1-pro` | Flagship | $1.00 | $5.00 | **CÓ** | 1,048,576 (1M) | ✅ **CÓ** | Native visual understanding, 1M context |
| `kimi-k3` | Flagship | $1.50 | $7.50 | Không | 1,048,576 (1M) | ✅ **CÓ** | Kimi Vision Model thế hệ K3 |
| `kimi-k2.7-code` | Standard | $0.48 | $2.00 | Không | 200,000 | ❌ Không | Chuyên viết code (Text-only) |
| `kimi-k2.6` | Standard | $0.48 | $2.00 | Không | 200,000 | ❌ Không | Text-only |

---

### 2.8. xAI Grok (9 models)
*Đặc trưng:* Chỉ `grok-4.7` hỗ trợ Vision; các bản cũ hơn là Text-only.*

| Model ID | Phân khúc (Tier) | Giá Input / 1M | Giá Output / 1M | Free? | Context Window | Hỗ trợ Vision (Đọc ảnh)? | Ghi chú kỹ thuật |
| :--- | :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| `grok-4.7` | Flagship | $1.20 | $2.40 | Không | 524,288 (500k) | ✅ **CÓ** | Model mới nhất của xAI hỗ trợ Vision |
| `grok-4.6` | Flagship | $0.50 | $2.00 | **CÓ** | 524,288 (500k) | ❌ Không | Text-only |
| `grok-4.5` | Flagship | $0.50 | $2.00 | **CÓ** | 524,288 (500k) | ❌ Không | Text-only |
| `grok-4.3` | Standard | $1.20 | $2.40 | Không | 524,288 (500k) | ❌ Không | Text-only |
| `grok-4.20-multi-agent-0309` | Standard | $1.20 | $2.40 | Không | 524,288 (500k) | ❌ Không | Phối hợp đa tác tử (Text-only) |
| `grok-imagine-image` | Image | Theo lượt | Theo lượt | Không | - | 🖼️ Sinh ảnh | Không dùng cho chat |
| `grok-imagine-image-2.0` | Image | Theo lượt | Theo lượt | Không | - | 🖼️ Sinh ảnh | Nâng cấp |
| `grok-imagine-video-1.5` | Video | Theo lượt | Theo lượt | Không | - | 🎥 Sinh video | Tạo video AI |
| `grok-imagine-video-1.5-lite` | Video | Theo lượt | Theo lượt | Không | - | 🎥 Sinh video | Video bản nhẹ |

---

### 2.9. Xiaomi, MiniMax & Tencent (5 models)

| Nhà sản xuất | Model ID | Tier | Giá In / Out ($/1M) | Free? | Context | Vision? | Ghi chú kỹ thuật |
| :--- | :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| **Xiaomi** | `mimo-v2.5-pro` | Flagship | $0.50 / $1.50 | Không | 1,048,576 | ✅ **CÓ** | Flagship của Xiaomi, hỗ trợ Vision |
| **MiniMax** | `minimax-m3` | Economy | $0.15 / $0.60 | **CÓ** | 1,048,576 | ❌ Không | Xử lý văn bản giá rẻ (Text-only) |
| **MiniMax** | `minimax-m2.7` | Economy | $0.15 / $0.60 | **CÓ** | 1,048,576 | ❌ Không | Text-only |
| **Tencent** | `hy4-preview` | Standard | $0.40 / $1.20 | **CÓ** | 128,000 | ❌ Không | Hunyuan 4 text |
| **Tencent** | `hy3` | Economy | $0.075 / $0.25 | **CÓ** | 128,000 | ❌ Không | Hunyuan 3 text |

---

## 3. Quy tắc bắt buộc cho AI Agent khi cấu hình & định tuyến
1. **Khi người dùng tải ảnh đính kèm (`hasImages = true`):**
   - Chỉ được phép định tuyến sang các model có nhãn ✅ **CÓ** Vision.
   - **Các model Miễn phí có Vision:** `deepseek-v4-flash`, `claude-sonnet-5-5`, `qwen3.8-max`, `glm-5.3-flash`, `gpt-6-sol`, `gpt-6-luna`, `kimi-k3.1-pro`.
   - **Các model Trả phí có Vision:** `claude-opus-5-5`, `gemini-3.8-flash`, `grok-4.7`, `mimo-v2.5-pro`.
   - Tuyệt đối **không gửi payload ảnh** vào các model Text-only (`deepseek-v4-pro`, `glm-5.3`, `grok-4.5/4.6`, `gpt-5.3-codex`, `minimax-m3`) để tránh lỗi 400 Bad Request từ gateway.
2. **Khi hội thoại chỉ có văn bản thuần:**
   - Ưu tiên hàng đầu: `deepseek-v4-flash` (tốc độ cao, chi phí thấp nhất $0.07/1M).
