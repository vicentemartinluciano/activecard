package com.reactnativeandroidwidget;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Rect;
import android.provider.Settings;
import android.view.View;
import android.view.ViewGroup;
import android.widget.RemoteViews;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.io.BufferedReader;
import java.io.FileReader;
import java.security.MessageDigest;

/** Native launcher animation; no JS timer, alarms or additional service. */
public final class ActiveCardWidgetFlame {
    private static final int FRAMES = 48;
    private ActiveCardWidgetFlame() {}

    public static void apply(Context context, int widgetId, RemoteViews remote, View root) {
        remote.removeAllViews(R.id.activecard_flame_container);
        remote.setViewVisibility(R.id.activecard_flame_container, View.GONE);
        View flame = find(root);
        if (flame == null) return;
        Bitmap background = null;
        try {
            if (Settings.System.getFloat(context.getContentResolver(), "animator_duration_scale", 1f) <= 0f) return;
            Rect bounds = new Rect();
            flame.getDrawingRect(bounds);
            ((ViewGroup) root).offsetDescendantRectToMyCoords(flame, bounds);
            if (bounds.width() <= 0 || bounds.height() <= 0 || bounds.left < 0 || bounds.top < 0 || bounds.right > root.getWidth() || bounds.bottom > root.getHeight()) return;
            float scale = Math.min(1f, Math.min(128f / bounds.width(), 128f / bounds.height()));
            int width = Math.max(1, Math.round(bounds.width() * scale));
            int height = Math.max(1, Math.round(bounds.height() * scale));
            background = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            Canvas capture = new Canvas(background);
            capture.scale(scale, scale);
            capture.translate(-bounds.left, -bounds.top);
            // Cover the static flame with the actual backdrop, avoiding a double image.
            flame.setVisibility(View.INVISIBLE);
            try { root.draw(capture); } finally { flame.setVisibility(View.VISIBLE); }
            int[] pixels = new int[width * height];
            background.getPixels(pixels, 0, width, 0, 0, width, height);
            ByteBuffer buffer = ByteBuffer.allocate(pixels.length * 4);
            buffer.asIntBuffer().put(pixels);
            MessageDigest hash = MessageDigest.getInstance("SHA-256");
            hash.update(((String) flame.getTag()).getBytes(StandardCharsets.UTF_8));
            byte[] digest = hash.digest(buffer.array());
            StringBuilder key = new StringBuilder("flame-v1-" + width + "-" + height + "-");
            for (byte value : digest) key.append(String.format("%02x", value & 0xff));
            File folder = new File(context.getFilesDir(), "widget_images");
            if (!folder.isDirectory() && !folder.mkdirs()) return;
            String prefix = "widget_" + widgetId + "_flame_";
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
                    Bitmap fire = null;
                    try (InputStream input = context.getAssets().open("activecard_widget_flame/frame-" + i + ".png")) {
                        fire = BitmapFactory.decodeStream(input);
                        if (fire == null) throw new IllegalStateException("Invalid flame frame");
                        new Canvas(frame).drawBitmap(fire, null, new Rect(0, 0, width, height), new Paint(Paint.FILTER_BITMAP_FLAG));
                        RNWidgetImageProvider.writeImage(context, name, frame);
                        if (new File(folder, name).length() == 0) throw new IllegalStateException("Missing flame frame");
                    } finally { frame.recycle(); if (fire != null) fire.recycle(); }
                }
                RemoteViews child = new RemoteViews(context.getPackageName(), R.layout.activecard_flame_frame);
                child.setImageViewUri(R.id.activecard_flame_image, RNWidgetImageProvider.getImageUri(context, name));
                animation.addView(R.id.activecard_flame_flipper, child);
            }
            if (!cached) try (FileOutputStream output = new FileOutputStream(state)) { output.write(key.toString().getBytes(StandardCharsets.UTF_8)); }
            remote.addView(R.id.activecard_flame_container, animation);
            remote.setViewVisibility(R.id.activecard_flame_container, View.VISIBLE);
        } catch (Exception ignored) {
            // The original static image and streak text stay readable on failure.
            remote.removeAllViews(R.id.activecard_flame_container);
            remote.setViewVisibility(R.id.activecard_flame_container, View.GONE);
        } finally { if (background != null) background.recycle(); }
    }

    private static View find(View view) {
        if (view.getTag() instanceof String && ((String) view.getTag()).startsWith("activecard-flame:")) return view;
        if (view instanceof ViewGroup) for (int i = 0; i < ((ViewGroup) view).getChildCount(); i++) {
            View result = find(((ViewGroup) view).getChildAt(i));
            if (result != null) return result;
        }
        return null;
    }
}
