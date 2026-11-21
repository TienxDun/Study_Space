# UI Reference Repos — nguồn tham khảo cho skill & UI ZenStudy

> Cập nhật: 2026-11-01. Star lấy từ GitHub API cùng ngày; star sẽ thay đổi theo thời gian.
> Mục đích: chọn repo để **học pattern**, không copy nguyên app.
> Phạm vi: chat v2, admin console và design system; không đụng chatbot cũ.

## 1. Kết luận ngắn

- **Top star chưa chắc phù hợp.** `Dify` (160k) và `Open WebUI` (157k) là cả nền tảng AI, không phải thư viện UI.
- Với ZenStudy, 4 nguồn ưu tiên:
  1. **[taste-skill](https://github.com/Leonxlnx/taste-skill)** + **[awesome-design-md](https://github.com/VoltAgent/awesome-design-md)** — cách viết skill/design spec.
  2. **[shadcn/ui](https://github.com/shadcn-ui/ui)** + **[Radix UI](https://github.com/radix-ui/primitives)** — component accessible, hợp Tailwind.
  3. **[assistant-ui](https://github.com/assistant-ui/assistant-ui)** + **[Vercel AI Chatbot](https://github.com/vercel/ai-chatbot)** — pattern chat UI.
  4. **[Open WebUI](https://github.com/open-webui/open-webui)** + **[LobeChat](https://github.com/lobehub/lobe-chat)** — sidebar phiên, model picker, file/ảnh.
- Không copy nguyên kiến trúc Dify/Open WebUI. Chỉ lấy pattern UI.
- Kiểm tra LICENSE trước khi copy code; ưu tiên MIT/Apache nhưng vẫn phải đọc.

## 2. Bảng tổng hợp

| Repo | Star | Loại | Học gì | Dùng cho |
|---|---:|---|---|---|
| [langgenius/dify](https://github.com/langgenius/dify) | 160k | Nền tảng AI | Workflow/agent UI, knowledge, tool | Tham khảo, không copy |
| [open-webui/open-webui](https://github.com/open-webui/open-webui) | 157k | Nền tảng chat | Sidebar phiên, model picker, file/RAG, setting | Chat UX |
| [shadcn-ui/ui](https://github.com/shadcn-ui/ui) | 127k | Component | Primitive copy-paste, token, form/dialog | Nền UI |
| [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) | 125k | Design spec | Mẫu `DESIGN.md` của nhiều brand | Skill + DESIGN.md |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | 107k | Agent skill | Art direction, reference ảnh, browser check | Skill design |
| [ant-design/ant-design](https://github.com/ant-design/ant-design) | 100k | Design system | Form/table enterprise, token | Admin |
| [mui/material-ui](https://github.com/mui/material-ui) | 99k | Component | Material, theme, accessibility | Tham khảo |
| [tailwindlabs/tailwindcss](https://github.com/tailwindlabs/tailwindcss) | 98k | CSS framework | Token, responsive, utility | Nền hiện tại |
| [storybookjs/storybook](https://github.com/storybookjs/storybook) | 91k | Docs/testing | Catalogue component, trạng thái UI | Tài liệu hoá |
| [lobehub/lobe-chat](https://github.com/lobehub/lobe-chat) | 84k | Chat app | Session, agent, marketplace | Chat UX |
| [saadeghi/daisyui](https://github.com/saadeghi/daisyui) | 43k | Component Tailwind | Theme, component nhanh | Tham khảo |
| [chakra-ui/chakra-ui](https://github.com/chakra-ui/chakra-ui) | 41k | Component | Composition, API sạch | Tham khảo |
| [refinedev/refine](https://github.com/refinedev/refine) | 36k | Admin framework | CRUD, auth, dashboard | Admin |
| [motiondivision/motion](https://github.com/motiondivision/motion) | 35k | Animation | Micro-interaction, layout animation | Chat/UI |
| [mckaywrigley/chatbot-ui](https://github.com/mckaywrigley/chatbot-ui) | 33k | Chat app | Chat cơ bản; repo cũ | Tham khảo lịch sử |
| [mantinedev/mantine](https://github.com/mantinedev/mantine) | 32k | Component | Bộ component đầy đủ, hook | Tham khảo |
| [heroui-inc/heroui](https://github.com/heroui-inc/heroui) | 31k | Component | Component đẹp, motion sẵn | Tham khảo |
| [tailwindlabs/headlessui](https://github.com/tailwindlabs/headlessui) | 29k | Primitive | Accessible, không style | Nền UI |
| [recharts/recharts](https://github.com/recharts/recharts) | 28k | Chart | Biểu đồ React | Admin |
| [marmelab/react-admin](https://github.com/marmelab/react-admin) | 27k | Admin framework | CRUD SPA | Admin |
| [lucide-icons/lucide](https://github.com/lucide-icons/lucide) | 25k | Icon | Icon system | Tham khảo |
| [magicuidesign/magicui](https://github.com/magicuidesign/magicui) | 23k | Animated UI | Component copy-paste, effect | Điểm nhấn |
| [tabler/tabler-icons](https://github.com/tabler/tabler-icons) | 22k | Icon | Bộ icon lớn | Tham khảo |
| [vercel/ai-chatbot](https://github.com/vercel/ai-chatbot) | 21k | Chat app | Streaming, tool, artifact, Next.js | Chat UX |
| [microsoft/fluentui](https://github.com/microsoft/fluentui) | 20k | Design system | Token, component Microsoft | Tham khảo |
| [radix-ui/primitives](https://github.com/radix-ui/primitives) | 19k | Primitive | Dialog, popover, menu accessible | Nền UI |
| [gztchan/awesome-design](https://github.com/gztchan/awesome-design) | 18k | Resource list | Tài nguyên design | Skill |
| [adobe/react-spectrum](https://github.com/adobe/react-spectrum) | 16k | Design system | Accessibility, adaptive UI | Tham khảo |
| [primer/css](https://github.com/primer/css) | 13k | Design system | Token, component GitHub | Design spec |
| [emilkowalski/sonner](https://github.com/emilkowalski/sonner) | 13k | Toast | Toast nhẹ, accessible | Đã dùng |
| [pacocoursey/cmdk](https://github.com/pacocoursey/cmdk) | 13k | Command menu | Command palette | Chat/admin |
| [assistant-ui/assistant-ui](https://github.com/assistant-ui/assistant-ui) | 12.9k | Chat primitive | Thread, Message, Composer, attachment | Chat v2 |
| [origin-space/originui](https://github.com/origin-space/originui) | 10.8k | Component | Chi tiết tinh tế, ít phô trương | Chat/UI |
| [emilkowalski/vaul](https://github.com/emilkowalski/vaul) | 8.7k | Drawer | Drawer mobile | Chat mobile |
| [argyleink/open-props](https://github.com/argyleink/open-props) | 5.6k | Design tokens | CSS custom properties | Tokens |
| [amzn/style-dictionary](https://github.com/amzn/style-dictionary) | 4.9k | Token build | Token đa nền tảng | Tokens |
| [tremorlabs/tremor](https://github.com/tremorlabs/tremor) | 3.7k | Dashboard UI | Card, chart, KPI | Admin |

Ghi chú:

- `Dify`, `Open WebUI`, `LobeChat`, `Vercel AI Chatbot` là **ứng dụng**, không phải thư viện component.
- `chatbot-ui` cập nhật lần cuối 2024; chỉ đọc pattern.
- `Polaris` và `Tremor` có repo đã deprecated; chỉ tham khảo, không chọn làm nền.
- Project hiện dùng `@phosphor-icons/react`; không cần đổi sang Lucide/Tabler chỉ vì star cao.

## 3. Theo nhóm

### 3.1 Skill / design reference

- **[taste-skill](https://github.com/Leonxlnx/taste-skill)** — skill dạy agent gu thẩm mỹ, art direction, reference ảnh và browser check. Dùng làm nguồn chính cho skill `design-taste`.
- **[awesome-design-md](https://github.com/VoltAgent/awesome-design-md)** — bộ `DESIGN.md` của Stripe, Apple, Vercel… Dùng cấu trúc và nguyên tắc, **không copy brand asset**.
- **[awesome-design](https://github.com/gztchan/awesome-design)** — danh sách tài nguyên design rộng.

### 3.2 Component / design system

- **[shadcn/ui](https://github.com/shadcn-ui/ui)** — phù hợp nhất với Tailwind v4: copy component, dễ chỉnh theo token ZenStudy.
- **[Radix UI](https://github.com/radix-ui/primitives)** — accessibility cho dialog, popover, menu, tooltip.
- **[Headless UI](https://github.com/tailwindlabs/headlessui)** — primitive cho Tailwind.
- **[Base UI](https://github.com/mui/base-ui)** — primitive không style từ team Radix/Floating UI/MUI.
- **MUI / Ant Design / Chakra / Mantine / HeroUI / DaisyUI** — tham khảo API, theme, form, table; không trộn nhiều hệ component.
- **[Storybook](https://github.com/storybookjs/storybook)** — catalogue trạng thái component nếu UI phình to.

### 3.3 Chat UI

- **[assistant-ui](https://github.com/assistant-ui/assistant-ui)** — primitive chat gần nhất với nhu cầu: Thread, Message, Composer, attachment, streaming.
- **[Vercel AI Chatbot](https://github.com/vercel/ai-chatbot)** — pattern Next.js đầy đủ: streaming, tool, artifact, trạng thái.
- **[Open WebUI](https://github.com/open-webui/open-webui)** — sidebar phiên, model picker, file/RAG, setting, admin.
- **[LobeChat](https://github.com/lobehub/lobe-chat)** — bố cục chat nhiều tính năng, agent, session.
- **[Dify](https://github.com/langgenius/dify)** — workflow/agent/knowledge UI; tham khảo, không copy.

Nên học từ chat UI:

- Sidebar phiên + tạo/đổi tên/xoá.
- Model picker kèm capability.
- Attachment tray + preview.
- Streaming, stop, regenerate.
- Empty state, error state, retry.
- Context/token indicator.
- Report/flag câu trả lời AI.
- Mobile drawer/composer.

### 3.4 Motion / micro UX

- **[Motion](https://github.com/motiondivision/motion)** — đã có `framer-motion`; dùng cho layout, presence, streaming indicator.
- **[Magic UI](https://github.com/magicuidesign/magicui)** — effect copy-paste; chỉ dùng 1–2 điểm nhấn.
- **[Origin UI](https://github.com/origin-space/originui)** — component tinh tế, hợp phong cách glass.
- **[Sonner](https://github.com/emilkowalski/sonner)** — toast; project đã dùng.
- **[Vaul](https://github.com/emilkowalski/vaul)** — drawer mobile.
- **[cmdk](https://github.com/pacocoursey/cmdk)** — command palette.

### 3.5 Admin / dashboard

- **[Refine](https://github.com/refinedev/refine)** — CRUD/admin nhanh.
- **[React Admin](https://github.com/marmelab/react-admin)** — admin SPA.
- **[Recharts](https://github.com/recharts/recharts)** — chart.
- **[Tremor](https://github.com/tremorlabs/tremor)** — card/KPI/chart; repo nhỏ hơn nhưng gọn.

### 3.6 Token / docs / icon

- **[Open Props](https://github.com/argyleink/open-props)** — CSS variables tham khảo.
- **[Style Dictionary](https://github.com/amzn/style-dictionary)** — build token đa nền tảng.
- **[Primer](https://github.com/primer/css)** — token/component GitHub.
- **[Carbon](https://github.com/carbon-design-system/carbon)** — design system IBM.
- **[Polaris](https://github.com/Shopify/polaris)** — tham khảo, đã deprecated.
- **[Lucide](https://github.com/lucide-icons/lucide)**, **[Tabler](https://github.com/tabler/tabler-icons)** — tham khảo icon; ZenStudy đang dùng Phosphor.

## 4. Map thành skill

| Skill | Nguồn chính | Nội dung |
|---|---|---|
| `design-taste` | taste-skill, Magic UI, Origin UI | Art direction, reference ảnh, browser check |
| `design-spec` | awesome-design-md, Primer, Carbon | Viết `DESIGN.md`, token, component rules |
| `chat-ui` | assistant-ui, Vercel AI Chatbot, Open WebUI, LobeChat | Thread, composer, attachment, session, model picker |
| `component-system` | shadcn/ui, Radix, Headless UI, Tailwind, Storybook | Primitive, accessibility, token |
| `motion-ui` | Motion, Sonner, Vaul, cmdk | Micro-interaction, drawer, toast, command menu |
| `admin-dashboard` | Refine, React Admin, Recharts, Tremor | CRUD, chart, KPI |
| `design-tokens` | Open Props, Style Dictionary, Tailwind | Token, theme, dark mode |

## 5. Áp dụng cho chat v2 UI reset

### Nguồn chính

1. **taste-skill + awesome-design-md** → chốt hướng thẩm mỹ, viết `DESIGN.md` cho chat v2.
2. **shadcn/ui + Radix** → primitive accessible.
3. **assistant-ui** → cấu trúc Thread/Message/Composer.
4. **Open WebUI/LobeChat** → sidebar phiên, model picker, attachment tray.
5. **Motion + Origin UI** → điểm nhấn, không lạm dụng glass/blur.

### Nên mượn

- Cấu trúc message list + composer.
- Trạng thái streaming/stop/regenerate.
- Sidebar phiên + session item.
- Attachment preview + remove.
- Model picker có capability (`32k`, `ảnh`).
- Context indicator + trimmed badge.
- Empty/error/loading states.
- Mobile drawer + safe-area.

### Không nên copy

- Toàn bộ kiến trúc Dify/Open WebUI.
- Theme Material/Ant mặc định.
- Quá nhiều animation hoặc blur.
- Brand asset/logo từ awesome-design-md.
- Component có license không rõ.

### Cấu trúc code đề xuất

```text
src/features/chat-v2/
  hooks/useChatV2.ts        # state, stream, stop, regenerate, attachments
  components/
    ChatV2Shell.tsx
    ChatHeader.tsx
    ModelPicker.tsx
    MessageList.tsx
    Composer.tsx
    AttachmentTray.tsx
    ContextBar.tsx
    SessionDrawer.tsx       # chỗ dành cho Sprint 3
    ReportDialog.tsx         # chỗ dành cho S5
  lib/                       # api, sse, tokens, attachments, contract
```

## 6. Quy trình dùng repo làm skill

1. **Chọn repo theo mục tiêu**, không theo star.
2. Đọc README, examples, LICENSE, độ mới.
3. Rút ra **10–20 quy tắc** vào `DESIGN.md` hoặc skill:
   - typography scale,
   - spacing,
   - màu/token,
   - component states,
   - motion,
   - mobile rules.
4. Dựng inventory component trước khi code.
5. Áp dụng vào project với token hiện có; không copy theme.
6. Chụp screenshot desktop/mobile, kiểm tra bằng browser.
7. Ghi lại pattern đã học vào skill để lần sau dùng lại.

## 7. Checklist trước khi copy

- [ ] LICENSE cho phép dùng/thương mại?
- [ ] Repo còn maintain không?
- [ ] Có phụ thuộc nặng/không tương thích Next 16/React 19?
- [ ] Có hỗ trợ Tailwind v4?
- [ ] Accessibility: keyboard, focus, screen reader?
- [ ] Mobile: touch target, safe area, scroll?
- [ ] Bundle size và animation performance?
- [ ] Có brand asset/attribution phải giữ?
- [ ] Có thể viết lại bằng token ZenStudy thay vì copy style?

## 8. Ghi chú cập nhật

- Star là snapshot 2026-11-01; nên rà lại mỗi quý.
- Repo UI thay đổi nhanh; ưu tiên repo còn commit trong 6 tháng gần nhất.
- Với ZenStudy, ưu tiên **shadcn/ui + Radix + assistant-ui + taste-skill**; các repo còn lại dùng để tham khảo có chọn lọc.
