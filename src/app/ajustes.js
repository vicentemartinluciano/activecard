import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import ActionSheet from "../components/ActionSheet";
import Collapsible from "../components/Collapsible";
import PercentSlider from "../components/PercentSlider";
import Stagger from "../components/Stagger";
import { Button, Card, confirmAsync, Field, Screen } from "../components/ui";
import { listDecks, updateDeckPriority } from "../db/decks";
import { DEFAULT_LIMITS, getDailyLimits } from "../db/reviewQueue";
import { getSetting, setSetting } from "../db/settings";
import { getNotionToken, getOpenAIKey, setNotionToken, setOpenAIKey } from "../lib/keys";
import {
  exportBackup,
  listExportableSources,
  pickBackupFile,
  prepareParsedAdditiveImport,
  restoreParsedBackup,
} from "../lib/backupIO";
import { setPendingImport } from "../lib/pendingImport";
import {
  DEFAULT_REMINDER,
  getReminderPrefs,
  parseReminderTime,
  setReminderPrefs,
  syncReviewReminder,
  updateReviewReminderEnabled,
} from "../lib/notifications";
import { colors, spacing, type } from "../theme";

export default function Ajustes() {
  const router = useRouter();
  const [decks, setDecks] = useState([]);
  const [limits, setLimits] = useState(DEFAULT_LIMITS);
  const [openAIKey, setOpenAIKeyInput] = useState("");
  const [notionToken, setNotionTokenInput] = useState("");
  const [keysStatus, setKeysStatus] = useState(null);
  const [backupStatus, setBackupStatus] = useState(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupSources, setBackupSources] = useState([]);
  const [selectedBackupSources, setSelectedBackupSources] = useState([]);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [importModeOpen, setImportModeOpen] = useState(false);
  const [pickedBackup, setPickedBackup] = useState(null);
  const [userName, setUserName] = useState("");
  const [nameStatus, setNameStatus] = useState(null);
  const [lastAuto, setLastAuto] = useState(null);
  const [reminder, setReminder] = useState(DEFAULT_REMINDER);
  const [reminderTime, setReminderTime] = useState(DEFAULT_REMINDER.time);
  const [reminderStatus, setReminderStatus] = useState(null);

  const load = useCallback(async () => {
    setDecks(await listDecks());
    setLimits(await getDailyLimits());
    setUserName(await getSetting("userName", "Martín"));
    setLastAuto(await getSetting("lastAutoBackup", null));
    setOpenAIKeyInput(getOpenAIKey() || "");
    if (Platform.OS !== "web") {
      const prefs = await getReminderPrefs();
      setReminder(prefs);
      setReminderTime(prefs.time);
    }
    if (Platform.OS === "web") {
      setNotionTokenInput(getNotionToken() || "");
    }
  }, []);

  const refresh = useCallback(() => {
    load();
  }, [load]);

  useFocusEffect(refresh);

  const changePriority = async (deckId, priority) => {
    await updateDeckPriority(deckId, priority);
    load();
  };

  const changeLimit = async (key, value) => {
    const next = { ...limits, [key]: value };
    setLimits(next); // optimista: el slider tiene que responder al toque
    await setSetting("dailyLimits", next);
  };

  const saveName = async () => {
    const clean = userName.trim();
    if (!clean) return;
    await setSetting("userName", clean);
    setNameStatus("Guardado ✓");
    setTimeout(() => setNameStatus(null), 2500);
  };

  const toggleReminder = async (enabled) => {
    setReminder((current) => ({ ...current, enabled }));
    setReminderStatus(null);
    try {
      const { prefs, result } = await updateReviewReminderEnabled(enabled, reminderTime);
      setReminder(prefs);
      if (!enabled) {
        setReminderStatus("Recordatorio desactivado.");
        return;
      }
      if (result.status === "permission-denied") {
        setReminderStatus(
          "El permiso fue rechazado. El recordatorio quedó desactivado; podés habilitarlo desde los ajustes de Android."
        );
      } else if (result.status === "no-pending") {
        setReminderStatus("Activado. Se programará cuando haya tarjetas pendientes.");
      } else {
        setReminderStatus("Recordatorio programado ✓");
      }
    } catch (e) {
      setReminder((current) => ({ ...current, enabled: false }));
      setReminderStatus(e.message || "No pudimos configurar el recordatorio.");
    }
  };

  const saveReminderTime = async () => {
    const parsed = parseReminderTime(reminderTime);
    if (!parsed) {
      setReminderStatus("Usá una hora válida en formato HH:MM.");
      return;
    }
    try {
      const prefs = await setReminderPrefs({ time: parsed.formatted });
      setReminder(prefs);
      setReminderTime(prefs.time);
      const result = await syncReviewReminder();
      setReminderStatus(
        result.status === "scheduled"
          ? "Nueva hora programada ✓"
          : "Hora guardada. Se programará cuando haya pendientes."
      );
    } catch (e) {
      setReminderStatus(e.message || "No pudimos guardar la hora.");
    }
  };

  const pausados = decks.filter((d) => d.priority === 0).length;

  const saveKeys = async () => {
    await setOpenAIKey(openAIKey);
    if (Platform.OS === "web") await setNotionToken(notionToken);
    setKeysStatus("Guardadas ✓");
    setTimeout(() => setKeysStatus(null), 2500);
  };

  const doExport = async () => {
    setBackupBusy(true);
    setBackupStatus(null);
    try {
      const sources = await listExportableSources();
      if (sources.length) {
        setBackupSources(sources);
        setSelectedBackupSources([]);
        setSourcePickerOpen(true);
        return;
      }
      const name = await exportBackup(new Date(), { sourceKeys: [] });
      setBackupStatus(`Exportado: ${name}`);
    } catch (e) {
      setBackupStatus(`Error al exportar: ${e.message || e}`);
    } finally {
      setBackupBusy(false);
    }
  };

  const finishExport = async (sourceKeys) => {
    setSourcePickerOpen(false);
    setBackupBusy(true);
    setBackupStatus(null);
    try {
      const name = await exportBackup(new Date(), { sourceKeys });
      const suffix = sourceKeys.length
        ? ` · ${sourceKeys.length} ${sourceKeys.length === 1 ? "archivo incluido" : "archivos incluidos"}`
        : " · sin archivos adjuntos";
      setBackupStatus(`Exportado: ${name}${suffix}`);
    } catch (e) {
      setBackupStatus(`Error al exportar: ${e.message || e}`);
    } finally {
      setBackupBusy(false);
    }
  };

  const toggleBackupSource = (key) => {
    setSelectedBackupSources((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  };

  const doImport = async () => {
    setBackupBusy(true);
    setBackupStatus(null);
    try {
      const picked = await pickBackupFile();
      if (!picked) return;
      setPickedBackup(picked);
      setImportModeOpen(true);
    } catch (e) {
      setBackupStatus(`Error al importar: ${e.message || e}`);
    } finally {
      setBackupBusy(false);
    }
  };

  const replaceImport = async () => {
    if (!pickedBackup) return;
    setImportModeOpen(false);
    setBackupBusy(true);
    try {
      const ok = await confirmAsync(
        "Reemplazar todo",
        `Esto borra los datos actuales y los reemplaza por los del archivo (${pickedBackup.decks} mazos, ${pickedBackup.cards} tarjetas). No se puede deshacer.`
      );
      if (!ok) {
        setPickedBackup(null);
        return;
      }
      const counts = await restoreParsedBackup(pickedBackup.parsed);
      setBackupStatus(`Importado: ${counts.decks} mazos, ${counts.cards} tarjetas.`);
      setPickedBackup(null);
      load();
    } catch (e) {
      setBackupStatus(`Error al importar: ${e.message || e}`);
    } finally {
      setBackupBusy(false);
    }
  };

  const previewAdditiveImport = async () => {
    if (!pickedBackup) return;
    setImportModeOpen(false);
    setBackupBusy(true);
    setBackupStatus(null);
    try {
      const plan = await prepareParsedAdditiveImport(pickedBackup.parsed);
      setPendingImport({ parsed: pickedBackup.parsed, plan });
      setPickedBackup(null);
      router.push("/importar-respaldo");
    } catch (e) {
      setBackupStatus(`Error al analizar: ${e.message || e}`);
    } finally {
      setBackupBusy(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: "Ajustes" }} />
      <ScrollView contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
        <Stagger style={{ marginBottom: 0 }}>
        <Collapsible
          icon="calendar"
          title="Carga diaria"
          summary={`${limits.maxReviews} repasos · ${limits.maxNew} nuevas`}
          defaultOpen
        >
          <View style={styles.limitItem}>
            <Text style={type.body}>Máximo de repasos por día</Text>
            <PercentSlider
              value={limits.maxReviews}
              min={5}
              max={100}
              step={5}
              formatLabel={(v) => `${v}`}
              onChange={(v) => changeLimit("maxReviews", v)}
            />
          </View>
          <View style={styles.limitItem}>
            <Text style={type.body}>Tarjetas nuevas por día</Text>
            <PercentSlider
              value={limits.maxNew}
              min={0}
              max={50}
              step={5}
              formatLabel={(v) => `${v}`}
              onChange={(v) => changeLimit("maxNew", v)}
            />
          </View>
          <Text style={type.small}>
            Lo que sobra pasa al día siguiente, empezando por los mazos de mayor prioridad. El
            tope de tarjetas nuevas protege las semanas que vienen: cada nueva que aceptás hoy
            vuelve mañana, en cuatro días y en dos semanas.
          </Text>
        </Collapsible>

        {Platform.OS !== "web" ? (
          <Collapsible
            icon="bell"
            title="Recordatorio de repaso"
            summary={reminder.enabled ? `Activo · ${reminder.time}` : "Desactivado"}
          >
            <View style={styles.reminderToggle}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={type.body}>Avisarme si quedan pendientes</Text>
                <Text style={type.small}>
                  Si ya completaste el día, ActiveCard no te interrumpe.
                </Text>
              </View>
              <Switch
                value={reminder.enabled}
                onValueChange={toggleReminder}
                trackColor={{ false: colors.surfaceHigh, true: colors.accentSoft }}
                thumbColor={reminder.enabled ? colors.accentText : colors.textMuted}
              />
            </View>
            <View style={styles.reminderTimeRow}>
              <Field
                value={reminderTime}
                onChangeText={setReminderTime}
                placeholder="20:30"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                style={{ flex: 1 }}
              />
              <Button label="Guardar hora" onPress={saveReminderTime} />
            </View>
            {reminderStatus ? <Text style={type.small}>{reminderStatus}</Text> : null}
          </Collapsible>
        ) : null}

        <Collapsible
          icon="sliders"
          title="Prioridad de los mazos"
          summary={
            decks.length === 0
              ? "Todavía no hay mazos"
              : `${decks.length} ${decks.length === 1 ? "mazo" : "mazos"}${
                  pausados > 0 ? ` · ${pausados} en pausa` : ""
                }`
          }
        >
          <Text style={type.small}>
            El porcentaje define cuánta presencia tiene cada mazo en el repaso diario. 0% lo
            pausa (no aparece hasta que lo subas; igual podés estudiarlo desde la Biblioteca).
          </Text>
          {decks.map((d) => (
            <View key={d.id} style={styles.priorityItem}>
              <Text style={type.body}>{d.name}</Text>
              <PercentSlider value={d.priority} onChange={(p) => changePriority(d.id, p)} />
            </View>
          ))}
        </Collapsible>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Respaldo</Text>
          <Text style={type.small}>
            Exportá un archivo con todos tus mazos, tarjetas y conexiones. Sirve como backup y
            para pasar datos entre el celular y la versión web (no se sincronizan solos).
          </Text>
          {Platform.OS !== "web" ? (
            <Text style={type.small}>
              {lastAuto
                ? `Copia automática en el teléfono: ${new Date(lastAuto).toLocaleDateString("es-AR")}.`
                : "Se guarda una copia automática en el teléfono cada semana."}
            </Text>
          ) : null}
          <Button
            label={backupBusy ? "Un momento…" : "Exportar datos"}
            onPress={doExport}
            disabled={backupBusy}
          />
          <Button
            label={backupBusy ? "Un momento…" : "Importar datos"}
            kind="danger"
            onPress={doImport}
            disabled={backupBusy}
          />
          {backupStatus ? <Text style={type.small}>{backupStatus}</Text> : null}
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Conexión con la IA</Text>
          <Text style={type.small}>
            {Platform.OS === "web"
              ? "Las claves quedan guardadas solo en este navegador."
              : "Pegá tu clave de OpenAI una vez. Queda solo en este teléfono y no se incluye en los respaldos."}
          </Text>
          <Text style={type.small}>Clave de OpenAI</Text>
          <Field
            value={openAIKey}
            onChangeText={setOpenAIKeyInput}
            placeholder="sk-…"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          {Platform.OS === "web" ? (
            <>
            <Text style={type.small}>Token de Notion</Text>
            <Field
              value={notionToken}
              onChangeText={setNotionTokenInput}
              placeholder="ntn_…"
              autoCapitalize="none"
              secureTextEntry
            />
            </>
          ) : null}
          <Button label="Guardar conexión" kind="primary" onPress={saveKeys} />
          {keysStatus ? <Text style={type.small}>{keysStatus}</Text> : null}
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Tu nombre</Text>
          <Text style={type.small}>Con esto te saluda la pantalla de Inicio.</Text>
          <View style={styles.nameRow}>
            <Field
              value={userName}
              onChangeText={setUserName}
              placeholder="Tu nombre"
              style={{ flex: 1 }}
            />
            <Button label="Guardar" kind="primary" onPress={saveName} />
          </View>
          {nameStatus ? <Text style={type.small}>{nameStatus}</Text> : null}
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Gimnasio Mental</Text>
          <Button label="Ver mis ideas" onPress={() => router.push("/gimnasio")} />
        </Card>
        </Stagger>
      </ScrollView>
      <ActionSheet
        visible={importModeOpen}
        onClose={() => {
          setImportModeOpen(false);
          setPickedBackup(null);
        }}
        title="¿Cómo querés importar?"
      >
        <Text style={type.small}>
          Podés reemplazar tu biblioteca completa o revisar qué información nueva querés sumar.
        </Text>
        <Button label="Agregar a mis datos" kind="primary" onPress={previewAdditiveImport} />
        <Button label="Reemplazar todo" kind="danger" onPress={replaceImport} />
        <Button label="Cancelar" kind="ghost" onPress={() => {
          setImportModeOpen(false);
          setPickedBackup(null);
        }} />
      </ActionSheet>
      <ActionSheet
        visible={sourcePickerOpen}
        onClose={() => setSourcePickerOpen(false)}
        title="¿Incluir archivos adjuntos?"
      >
        <Text style={type.small}>
          Las conversaciones se respaldan siempre. Marcá solo los archivos que también querés
          guardar dentro del respaldo.
        </Text>
        <Pressable
          style={styles.selectAll}
          onPress={() =>
            setSelectedBackupSources(
              selectedBackupSources.length === backupSources.length
                ? []
                : backupSources.map((source) => source.key)
            )
          }
        >
          <Text style={type.small}>
            {selectedBackupSources.length === backupSources.length ? "Quitar todos" : "Seleccionar todos"}
          </Text>
        </Pressable>
        <ScrollView style={styles.sourceList} contentContainerStyle={{ gap: spacing.xs }}>
          {backupSources.map((source) => {
            const selected = selectedBackupSources.includes(source.key);
            return (
              <Pressable
                key={source.key}
                style={[styles.sourceRow, selected && styles.sourceRowSelected]}
                onPress={() => toggleBackupSource(source.key)}
              >
                <View style={[styles.sourceCheck, selected && styles.sourceCheckSelected]}>
                  {selected ? <Text style={styles.sourceCheckText}>✓</Text> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={type.body} numberOfLines={1}>{source.name}</Text>
                  <Text style={type.small}>
                    {Math.max(1, Math.round(source.sizeBytes / 1024))} KB
                    {source.occurrences > 1 ? ` · usado ${source.occurrences} veces` : ""}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        <Button
          label={
            selectedBackupSources.length
              ? `Exportar con ${selectedBackupSources.length}`
              : "Elegí al menos un archivo"
          }
          kind="primary"
          disabled={selectedBackupSources.length === 0}
          onPress={() => finishExport(selectedBackupSources)}
        />
        <Button label="Exportar sin archivos" kind="ghost" onPress={() => finishExport([])} />
      </ActionSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...type.label,
  },
  priorityItem: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  limitItem: {
    gap: spacing.xs,
  },
  nameRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  reminderToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  reminderTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  selectAll: {
    alignSelf: "flex-end",
    paddingVertical: spacing.xs,
  },
  sourceList: {
    maxHeight: 280,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surfaceHigh,
  },
  sourceRowSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  sourceCheck: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  sourceCheckSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  sourceCheckText: {
    color: "#FFFFFF",
    fontSize: 13,
  },
});
