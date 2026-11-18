package android.webkit;

/** Заглушка только для компиляции против android-23 (класс есть в Android 8+). В APK не попадает. */
public abstract class RenderProcessGoneDetail {
    public abstract boolean didCrash();
    public abstract int rendererPriorityAtExit();
}
