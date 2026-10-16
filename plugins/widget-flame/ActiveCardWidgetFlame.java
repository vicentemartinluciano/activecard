package com.reactnativeandroidwidget;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.net.Uri;
import android.graphics.Path;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Shader;
import android.provider.Settings;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.widget.RemoteViews;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableType;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Two bounded native animations; the static widget remains usable on failure. */
public final class ActiveCardWidgetFlame {
    private static final int FRAMES = 48;
    private static final Pattern PROGRESS = Pattern.compile("data-activecard-progress=\"([0-9.]+)\"");
    private ActiveCardWidgetFlame() {}

    public static boolean isCurrentSize(Context context, int widgetId, ReadableMap config) {
        ReadableMap props = config.getMap("props");
        return props != null && props.hasKey("width") && props.hasKey("height")
            && props.getType("width") == ReadableType.Number && props.getType("height") == ReadableType.Number
            && Math.round(props.getDouble("width")) == RNWidgetUtil.getWidgetWidth(context, widgetId)
            && Math.round(props.getDouble("height")) == RNWidgetUtil.getWidgetHeight(context, widgetId);
    }

    public static void tag(View view, String svg) {
        if (svg.contains("data-activecard-flame=\"active\"")) view.setTag("activecard-flame:active");
        Matcher match = PROGRESS.matcher(svg);
        if (match.find()) view.setTag("activecard-progress:" + match.group(1));
    }

    public static void apply(Context context, int widgetId, RemoteViews remote, View root) {
        remote.removeAllViews(R.id.activecard_flame_container);
        remote.setViewVisibility(R.id.activecard_flame_container, View.GONE);
        if (Settings.Global.getFloat(context.getContentResolver(), Settings.Global.ANIMATOR_DURATION_SCALE, 1f) <= 0f) return;
        List<View> motions = new ArrayList<>();
        find(root, motions);
        int applied = 0;
        for (View motion : motions) {
            try {
                if (addMotion(context, widgetId, remote, root, motion)) applied++;
            } catch (Exception error) {
                Log.w("ActiveCardWidget", "Static animation fallback: " + error.getClass().getSimpleName());
            }
        }
        if (applied > 0) remote.setViewVisibility(R.id.activecard_flame_container, View.VISIBLE);
    }

    private static boolean addMotion(Context context, int widgetId, RemoteViews remote, View root, View motion) throws Exception {
        String tag = (String) motion.getTag();
        boolean flame = tag.startsWith("activecard-flame:");
        Rect bounds = new Rect();
        motion.getDrawingRect(bounds);
        ((ViewGroup) root).offsetDescendantRectToMyCoords(motion, bounds);
        if (bounds.width() <= 0 || bounds.height() <= 0 || bounds.left < 0 || bounds.top < 0 || bounds.right > root.getWidth() || bounds.bottom > root.getHeight()) return false;
        File folder = new File(context.getFilesDir(), "widget_images");
        if (!folder.isDirectory() && !folder.mkdirs()) return false;
        RemoteViews animation = new RemoteViews(context.getPackageName(), R.layout.activecard_flame);
        animation.setImageViewResource(R.id.activecard_flame_backdrop, 0);
        animation.setViewPadding(R.id.activecard_flame_positioner, bounds.left, bounds.top, root.getWidth() - bounds.right, root.getHeight() - bounds.bottom);
        animation.removeAllViews(R.id.activecard_flame_flipper);
        String prefix = "widget_" + widgetId + "_motion_";
        if (flame) {
            // Capture the backdrop once, not in every flame frame. The transparent
            // fire assets are immutable and shared across sizes and instances.
            Bitmap background = Bitmap.createBitmap(bounds.width(), bounds.height(), Bitmap.Config.ARGB_8888);
            try {
                Canvas capture = new Canvas(background);
                capture.translate(-bounds.left, -bounds.top);
                motion.setVisibility(View.INVISIBLE);
                try { root.draw(capture); } finally { motion.setVisibility(View.VISIBLE); }
                String backdrop = prefix + "backdrop_" + bitmapKey(background) + ".png";
                writeIfMissing(context, folder, backdrop, background);
                animation.setImageViewUri(R.id.activecard_flame_backdrop, imageUri(context, backdrop));
            } finally { background.recycle(); }
            for (int i = 0; i < FRAMES; i++) {
                String name = "activecard_fire_v1_" + i + ".png";
                File file = new File(folder, name);
                if (file.length() == 0) {
                    try (InputStream input = context.getAssets().open("activecard_widget_flame/frame-" + i + ".png"); FileOutputStream output = new FileOutputStream(file)) {
                        byte[] bytes = new byte[8192];
                        int count;
                        while ((count = input.read(bytes)) != -1) output.write(bytes, 0, count);
                    }
                }
                addFrame(context, animation, name);
            }
        } else {
            // Only the transparent highlight is rasterized. Thirty-three small PNGs
            // replace 48 full-background copies; pause frames reuse the same URI.
            float scale = Math.min(1f, Math.min(512f / bounds.width(), 40f / bounds.height()));
            int width = Math.max(1, Math.round(bounds.width() * scale));
            int height = Math.max(1, Math.round(bounds.height() * scale));
            double pct = Double.parseDouble(tag.substring("activecard-progress:".length()));
            String key = prefix + "bar_v3_" + width + "_" + height + "_" + pct + "_";
            for (int i = 0; i < FRAMES; i++) {
                int frameIndex = Math.min(i, 32);
                String name = key + frameIndex + ".png";
                if (new File(folder, name).length() == 0) {
                    Bitmap frame = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
                    try {
                        drawSheen(frame, pct, frameIndex);
                        writeIfMissing(context, folder, name, frame);
                    } finally { frame.recycle(); }
                }
                new File(folder, name).setLastModified(System.currentTimeMillis());
                addFrame(context, animation, name);
            }
        }
        // Keep images currently being loaded by the host. Old sizes expire after
        // a day and the provider removes per-widget files when it is deleted.
        File[] expired = folder.listFiles(file -> file.getName().startsWith(prefix) && file.lastModified() < System.currentTimeMillis() - 86400000L);
        if (expired != null) for (File file : expired) file.delete();
        remote.addView(R.id.activecard_flame_container, animation);
        return true;
    }

    private static void writeIfMissing(Context context, File folder, String name, Bitmap bitmap) {
        File file = new File(folder, name);
        if (file.length() == 0) RNWidgetImageProvider.writeImage(context, name, bitmap);
        if (file.length() == 0) throw new IllegalStateException("Missing animation frame");
        // Also refresh last-used time so expiry never removes the active size.
        file.setLastModified(System.currentTimeMillis());
    }

    private static String bitmapKey(Bitmap bitmap) throws Exception {
        int[] pixels = new int[bitmap.getWidth() * bitmap.getHeight()];
        bitmap.getPixels(pixels, 0, bitmap.getWidth(), 0, 0, bitmap.getWidth(), bitmap.getHeight());
        ByteBuffer buffer = ByteBuffer.allocate(pixels.length * 4);
        buffer.asIntBuffer().put(pixels);
        StringBuilder key = new StringBuilder(bitmap.getWidth() + "_" + bitmap.getHeight() + "_");
        for (byte value : MessageDigest.getInstance("SHA-256").digest(buffer.array())) key.append(String.format("%02x", value & 0xff));
        return key.toString();
    }

    private static Uri imageUri(Context context, String name) {
        return new Uri.Builder().scheme("content").authority(context.getPackageName() + RNWidgetImageProvider.AUTHORITY_SUFFIX).appendPath(name).build();
    }

    private static void addFrame(Context context, RemoteViews animation, String name) {
        RemoteViews child = new RemoteViews(context.getPackageName(), R.layout.activecard_flame_frame);
        child.setImageViewUri(R.id.activecard_flame_image, imageUri(context, name));
        animation.addView(R.id.activecard_flame_flipper, child);
    }

    private static void drawSheen(Bitmap frame, double pct, int index) {
        if (index >= 32 || pct <= 0) return;
        float width = frame.getWidth();
        float height = frame.getHeight();
        float fill = (float) (width * Math.min(100, pct) / 100);
        float band = Math.max(height * 1.5f, fill * 0.35f);
        float x = -band + (fill + band * 2) * index / 31f;
        Canvas canvas = new Canvas(frame);
        Path clip = new Path();
        clip.addRoundRect(new RectF(0, 0, fill, height), height / 2, height / 2, Path.Direction.CW);
        canvas.clipPath(clip);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setShader(new LinearGradient(x - band / 2, 0, x + band / 2, height,
            new int[]{Color.TRANSPARENT, 0x99FFFFFF, Color.TRANSPARENT}, new float[]{0, 0.5f, 1}, Shader.TileMode.CLAMP));
        canvas.drawRect(0, 0, width, height, paint);
    }

    private static void find(View view, List<View> result) {
        if (view.getTag() instanceof String && ((String) view.getTag()).startsWith("activecard-")) result.add(view);
        if (view instanceof ViewGroup) for (int i = 0; i < ((ViewGroup) view).getChildCount(); i++) find(((ViewGroup) view).getChildAt(i), result);
    }
}
