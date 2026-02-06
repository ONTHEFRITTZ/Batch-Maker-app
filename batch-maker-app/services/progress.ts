import AsyncStorage from '@react-native-async-storage/async-storage';

export async function saveProgress(workflowId: number, stepIndex: number, checklist: any[]) {
  const key = `workflow-${workflowId}-progress`;
  await AsyncStorage.setItem(key, JSON.stringify({ stepIndex, checklist }));
}

export async function loadProgress(workflowId: number) {
  const key = `workflow-${workflowId}-progress`;
  const data = await AsyncStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}

export async function clearProgress(workflowId: number) {
  const key = `workflow-${workflowId}-progress`;
  await AsyncStorage.removeItem(key);
}
