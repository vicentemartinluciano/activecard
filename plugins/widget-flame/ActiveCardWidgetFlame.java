package com.reactnativeandroidwidget;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Shader;
import android.provider.Settings;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.widget.RemoteViews;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
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
        float scale = Math.min(1f, Math.min((flame ? 128f : 1024f) / bounds.width(), (flame ? 128f : 80f) / bounds.height()));
        int width = Math.max(1, Math.round(bounds.width() * scale));
        int height = Math.max(1, Math.round(bounds.height() * scale));
        Bitmap background = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        try {
            Canvas capture = new Canvas(background);
            capture.scale(scale, scale);
            capture.translate(-bounds.left, -bounds.top);
            if (flame) motion.setVisibility(View.INVISIBLE);
            try { root.draw(capture); } finally { if (flame) motion.setVisibility(View.VISIBLE); }
            int[] pixels = new int[width * height];
            background.getPixels(pixels, 0, width, 0, 0, width, height);
            ByteBuffer buffer = ByteBuffer.allocate(pixels.length * 4);
            buffer.asIntBuffer().put(pixels);
            MessageDigest hash = MessageDigest.getInstance("SHA-256");
            hash.update(tag.getBytes(StandardCharsets.UTF_8));
            StringBuilder key = new StringBuilder("motion-v2-" + width + "-" + height + "-");
            for (byte value : hash.digest(buffer.array())) key.append(String.format("%02x", value & 0xff));
            File folder = new File(context.getFilesDir(), "widget_images");
            if (!folder.isDirectory() && !folder.mkdirs()) return false;
            String prefix = "widget_" + widgetId + "_motion_" + (flame ? "flame_" : "bar_");
            File state = new File(folder, prefix + "state.txt");
            boolean cached = false;
            if (state.isFile()) try (BufferedReader reader = new BufferedReader(new FileReader(state))) { cached = key.toString().equals(reader.readLine()); }
            for (int i = 0; i < FRAMES; i++) cached &= new File(folder, prefix + i + ".png").length() > 0;
            RemoteViews animation = new RemoteViews(context.getPackageName(), R.layout.activecard_flame);
            animation.setViewPadding(R.id.activecard_flame_positioner, bounds.left, bounds.top, root.getWidth() - bounds.right, root.getHeight() - bounds.bottom);
            animation.removeAllViews(R.id.activecard_flame_flipper);
            for (int i = 0; i < FRAMES; i++) {
                String name = prefix + i + ".png";
                if (!cached) {
                    Bitmap frame = background.copy(Bitmap.Config.ARGB_8888, true);
                    try {
                        if (flame) drawFlame(context, frame, i);
                        else drawSheen(frame, Double.parseDouble(tag.substring("activecard-progress:".length())), i);
                        RNWidgetImageProvider.writeImage(context, name, frame);
                        if (new File(folder, name).length() == 0) throw new IllegalStateException("Missing animation frame");
                    } finally { frame.recycle(); }
                }
                RemoteViews child = new RemoteViews(context.getPackageName(), R.layout.activecard_flame_frame);
                child.setImageViewUri(R.id.activecard_flame_image, RNWidgetImageProvider.getImageUri(context, name));
                animation.addView(R.id.activecard_flame_flipper, child);
            }
            if (!cached) try (FileOutputStream output = new FileOutputStream(state)) { output.write(key.toString().getBytes(StandardCharsets.UTF_8)); }
            remote.addView(R.id.activecard_flame_container, animation);
            return true;
        } finally { background.recycle(); }
    }

    private static void drawFlame(Context context, Bitmap frame, int index) throws Exception {
        Bitmap fire = null;
        try (InputStream input = context.getAssets().open("activecard_widget_flame/frame-" + index + ".png")) {
            fire = BitmapFactory.decodeStream(input);
            if (fire == null) throw new IllegalStateException("Invalid flame frame");
            new Canvas(frame).drawBitmap(fire, null, new Rect(0, 0, frame.getWidth(), frame.getHeight()), new Paint(Paint.FILTER_BITMAP_FLAG));
        } finally { if (fire != null) fire.recycle(); }
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
