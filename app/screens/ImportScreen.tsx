import * as DocumentPicker from "expo-document-picker";
import React from "react";
import { Alert, Button, View, ActivityIndicator, Text } from "react-native";
import { parseSpreadsheetV2 } from "../../utils/parseSpreadsheet";
import { addWorkflow } from "../../services/database";
import { useRouter } from "expo-router";

export default function ImportScreen() {
  const router = useRouter();
  const [importing, setImporting] = React.useState(false);

  async function importFile() {
    try {
      setImporting(true);
      
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
      });

      if (result.canceled) {
        setImporting(false);
        return;
      }

      console.log('📥 Starting import...');
      
      // Parse the spreadsheet
      const steps = parseSpreadsheetV2(result.assets[0].uri);
      
      console.log(`\n📊 Parsed ${steps.length} total steps`);
      
      // Group steps by recipe name (sheet name)
      const workflowMap = new Map<string, typeof steps>();
      
      steps.forEach(step => {
        const workflowName = step.recipeName;
        if (!workflowMap.has(workflowName)) {
          workflowMap.set(workflowName, []);
        }
        workflowMap.get(workflowName)!.push(step);
      });

      // Create workflows
      let importedCount = 0;
      
      for (const [workflowName, workflowSteps] of workflowMap) {
        const workflowId = workflowName.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
        
        const workflow = {
          id: workflowId,
          name: workflowName,
          steps: workflowSteps.map(step => ({
            id: step.id,
            title: step.title,
            description: step.instructions,
            timerMinutes: step.suggestedTime,
            completed: false,
          })),
        };

        console.log(`\n💾 Saving workflow: ${workflowName}`);
        console.log(`   ${workflow.steps.length} steps`);
        
        // Show first step preview
        if (workflow.steps.length > 0) {
          const firstStep = workflow.steps[0];
          console.log(`   First step title: ${firstStep.title}`);
          console.log(`   Has checklist: ${firstStep.description.includes('📋 Checklist:')}`);
          
          if (firstStep.description.includes('📋 Checklist:')) {
            const checklistSection = firstStep.description.split('📋 Checklist:')[1];
            const itemCount = checklistSection.split('☐').length - 1;
            console.log(`   Checklist items: ${itemCount}`);
          }
        }
        
        await addWorkflow(workflow);
        importedCount++;
      }

      setImporting(false);
      Alert.alert(
        "✅ Import Successful", 
        `Imported ${importedCount} workflow(s) with ${steps.length} total steps.\n\nCheck console for details.`,
        [
          {
            text: "OK",
            onPress: () => router.back()
          }
        ]
      );
    } catch (error) {
      setImporting(false);
      console.error('❌ Import error:', error);
      Alert.alert("Import Failed", `Error: ${error}`);
    }
  }

  return (
    <View style={{ padding: 20, flex: 1, justifyContent: 'center' }}>
      {importing ? (
        <View style={{ alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={{ marginTop: 16, fontSize: 16 }}>Importing spreadsheet...</Text>
          <Text style={{ marginTop: 8, fontSize: 14, color: '#666' }}>Check console for progress</Text>
        </View>
      ) : (
        <>
          <Button title="Select Spreadsheet" onPress={importFile} />
          <Text style={{ marginTop: 16, fontSize: 12, color: '#666', textAlign: 'center' }}>
            Import Excel (.xlsx) files with recipe workflows
          </Text>
        </>
      )}
    </View>
  );
}