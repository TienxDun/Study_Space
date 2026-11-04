package space.zenstudy.app;

import android.os.Bundle;

import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Tràn viền trước khung hình đầu tiên (layout chạy sau onCreate). Nếu để plugin
        // StatusBar bật overlay sau khi trang đã vẽ, WebView cao thêm một khoảng và
        // toàn bộ nội dung splash tụt xuống giữa chừng (logo "nhảy" một lần).
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}
