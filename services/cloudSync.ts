// services/cloudSync.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { getBatches, getWorkflows } from "./database";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://your-api.vercel.app";

interface SyncResult {
  success: boolean;
  uploaded: number;
  errors: string[];
}

export async function pushToCloud(): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    uploaded: 0,
    errors: [],
  };

  try {
    console.log("Starting cloud sync...");

    // Get current session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error("Not authenticated. Please sign in first.");
    }

    const userId = session.user.id;
    console.log("User ID:", userId);

    // Get all local data
    const workflows = await getWorkflows();
    const batches = await getBatches();
  
    console.log(
      `Found: ${workflows.length} workflows, ${batches.length} batches`,
    );

    // Upload workflows
    for (const workflow of workflows) {
      try {
        const { error } = await supabase.from("workflows").upsert(
          {
            id: workflow.id,
            user_id: userId,
            name: workflow.name,
            steps: workflow.steps,
            claimed_by: workflow.claimedBy,
            claimed_by_name: workflow.claimedByName,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "id",
          },
        );

        if (error) {
          console.error("Workflow upload error:", error);
          result.errors.push(`Workflow ${workflow.name}: ${error.message}`);
        } else {
          result.uploaded++;
          console.log(`✅ Uploaded workflow: ${workflow.name}`);
        }
      } catch (err: any) {
        console.error("Workflow exception:", err);
        result.errors.push(`Workflow ${workflow.name}: ${err.message}`);
      }
    }

    // Upload batches
    for (const batch of batches) {
      try {
        const { error } = await supabase.from("batches").upsert(
          {
            id: batch.id,
            user_id: userId,
            workflow_id: batch.workflowId,
            name: batch.name,
            mode: batch.mode,
            units_per_batch: batch.unitsPerBatch,
            batch_size_multiplier: batch.batchSizeMultiplier,
            current_step_index: batch.currentStepIndex,
            completed_steps: batch.completedSteps,
            active_timers: batch.activeTimers,
            created_at:
              typeof batch.createdAt === "number"
                ? new Date(batch.createdAt).toISOString()
                : batch.createdAt,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "id",
          },
        );

        if (error) {
          console.error("Batch upload error:", error);
          result.errors.push(`Batch ${batch.name}: ${error.message}`);
        } else {
          result.uploaded++;
          console.log(`✅ Uploaded batch: ${batch.name}`);
        }
      } catch (err: any) {
        console.error("Batch exception:", err);
        result.errors.push(`Batch ${batch.name}: ${err.message}`);
      }
    }

    // Save last sync time
    await AsyncStorage.setItem("lastCloudSync", new Date().toISOString());

    if (result.errors.length > 0) {
      result.success = false;
      console.warn("⚠️ Sync completed with errors:", result.errors);
    } else {
      console.log("✅ Sync completed successfully!");
    }

    return result;
  } catch (error: any) {
    console.error("❌ Push error:", error);
    result.success = false;
    result.errors.push(error.message);
    return result;
  }
}

export async function pullFromCloud(): Promise<void> {
  try {
    console.log("Pulling data from cloud...");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error("Not authenticated");
    }

    const lastSync = await AsyncStorage.getItem("lastCloudSync");
    const url = `${API_URL}/api/sync/pull${lastSync ? `?lastSync=${lastSync}` : ""}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Pull failed: ${response.statusText}`);
    }

    const data = await response.json();

    console.log("Received from cloud:", {
      workflows: data.workflows?.length || 0,
      batches: data.batches?.length || 0,
      reports: data.reports?.length || 0,
    });

    // TODO: Merge data with local database
    // This would require implementing merge logic in database.ts

    await AsyncStorage.setItem("lastCloudSync", data.synced_at);
    console.log("✅ Pull completed successfully!");
  } catch (error) {
    console.error("❌ Pull error:", error);
    throw error;
  }
}

export async function getLastSyncTime(): Promise<Date | null> {
  const lastSync = await AsyncStorage.getItem("lastCloudSync");
  return lastSync ? new Date(lastSync) : null;
}