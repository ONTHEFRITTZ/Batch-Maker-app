import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PHOTOS_DIR = `${FileSystem.documentDirectory}batch_maker_photos/`;
const PHOTO_MANIFEST_KEY = '@photo_manifest';

interface PhotoManifest {
  [photoId: string]: {
    uri: string;
    createdAt: number;
    workflowId?: string;
    stepId?: string;
    batchId?: string;
  };
}

let photoManifest: PhotoManifest = {};

/**
 * Initialize photo storage system
 * Creates directory if it doesn't exist and loads manifest
 */
export async function initializePhotoStorage(): Promise<void> {
  try {
    // Create photos directory if it doesn't exist
    const dirInfo = await FileSystem.getInfoAsync(PHOTOS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
      console.log('📁 Photo directory created:', PHOTOS_DIR);
    }

    // Load manifest
    const stored = await AsyncStorage.getItem(PHOTO_MANIFEST_KEY);
    if (stored) {
      photoManifest = JSON.parse(stored);
      console.log(`📸 Loaded ${Object.keys(photoManifest).length} photos from manifest`);
    }
  } catch (error) {
    console.error('Error initializing photo storage:', error);
  }
}

/**
 * Save a photo from camera/gallery to persistent storage
 * @param sourceUri - Original URI from ImagePicker
 * @param context - Optional context (workflow, step, batch ID)
 * @returns Saved photo URI
 */
export async function savePhoto(
  sourceUri: string,
  context?: {
    workflowId?: string;
    stepId?: string;
    batchId?: string;
  }
): Promise<string> {
  try {
    const photoId = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const filename = `${photoId}.jpg`;
    const destUri = `${PHOTOS_DIR}${filename}`;

    // Copy file to persistent storage
    await FileSystem.copyAsync({
      from: sourceUri,
      to: destUri,
    });

    // Add to manifest
    photoManifest[photoId] = {
      uri: destUri,
      createdAt: Date.now(),
      workflowId: context?.workflowId,
      stepId: context?.stepId,
      batchId: context?.batchId,
    };

    // Save manifest
    await AsyncStorage.setItem(PHOTO_MANIFEST_KEY, JSON.stringify(photoManifest));

    console.log('✅ Photo saved:', destUri);
    return destUri;
  } catch (error) {
    console.error('Error saving photo:', error);
    throw error;
  }
}

/**
 * Save multiple photos at once
 * @param sourceUris - Array of original URIs from ImagePicker
 * @param context - Optional context (workflow, step, batch ID)
 * @returns Array of saved photo URIs
 */
export async function savePhotos(
  sourceUris: string[],
  context?: {
    workflowId?: string;
    stepId?: string;
    batchId?: string;
  }
): Promise<string[]> {
  try {
    const savedUris = await Promise.all(
      sourceUris.map(uri => savePhoto(uri, context))
    );
    return savedUris;
  } catch (error) {
    console.error('Error saving multiple photos:', error);
    throw error;
  }
}

/**
 * Delete a photo from storage
 * @param photoUri - URI of photo to delete
 */
export async function deletePhoto(photoUri: string): Promise<void> {
  try {
    // Find photoId by URI
    const photoId = Object.keys(photoManifest).find(
      id => photoManifest[id].uri === photoUri
    );

    if (!photoId) {
      console.warn('Photo not found in manifest:', photoUri);
      return;
    }

    // Delete file
    await FileSystem.deleteAsync(photoUri, { idempotent: true });

    // Remove from manifest
    delete photoManifest[photoId];

    // Save manifest
    await AsyncStorage.setItem(PHOTO_MANIFEST_KEY, JSON.stringify(photoManifest));

    console.log('✅ Photo deleted:', photoUri);
  } catch (error) {
    console.error('Error deleting photo:', error);
    throw error;
  }
}

/**
 * Delete multiple photos
 * @param photoUris - Array of photo URIs to delete
 */
export async function deletePhotos(photoUris: string[]): Promise<void> {
  try {
    await Promise.all(photoUris.map(uri => deletePhoto(uri)));
  } catch (error) {
    console.error('Error deleting multiple photos:', error);
    throw error;
  }
}

/**
 * Get all photos for a specific workflow
 */
export function getWorkflowPhotos(workflowId: string): string[] {
  return Object.values(photoManifest)
    .filter(photo => photo.workflowId === workflowId)
    .map(photo => photo.uri);
}

/**
 * Get all photos for a specific step
 */
export function getStepPhotos(workflowId: string, stepId: string): string[] {
  return Object.values(photoManifest)
    .filter(photo => photo.workflowId === workflowId && photo.stepId === stepId)
    .map(photo => photo.uri);
}

/**
 * Get all photos for a specific batch
 */
export function getBatchPhotos(batchId: string): string[] {
  return Object.values(photoManifest)
    .filter(photo => photo.batchId === batchId)
    .map(photo => photo.uri);
}

/**
 * Get photo file size (useful for UI)
 */
export async function getPhotoFileSize(photoUri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(photoUri);
    if (info.exists && 'size' in info) {
      return (info as any).size || 0;
    }
    return 0;
  } catch (error) {
    console.error('Error getting photo size:', error);
    return 0;
  }
}

/**
 * Get total storage used by photos
 */
export async function getTotalPhotoStorageUsed(): Promise<number> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(PHOTOS_DIR);
    if (!dirInfo.exists) return 0;

    const files = await FileSystem.readDirectoryAsync(PHOTOS_DIR);
    let totalSize = 0;

    for (const file of files) {
      const fileUri = `${PHOTOS_DIR}${file}`;
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists && 'size' in fileInfo) {
        totalSize += (fileInfo as any).size || 0;
      }
    }

    return totalSize;
  } catch (error) {
    console.error('Error calculating storage:', error);
    return 0;
  }
}

/**
 * Clear all photos (use with caution!)
 */
export async function clearAllPhotos(): Promise<void> {
  try {
    const files = await FileSystem.readDirectoryAsync(PHOTOS_DIR);
    await Promise.all(
      files.map(file => FileSystem.deleteAsync(`${PHOTOS_DIR}${file}`, { idempotent: true }))
    );

    photoManifest = {};
    await AsyncStorage.setItem(PHOTO_MANIFEST_KEY, JSON.stringify(photoManifest));

    console.log('✅ All photos cleared');
  } catch (error) {
    console.error('Error clearing photos:', error);
    throw error;
  }
}

/**
 * Get photo manifest (debug)
 */
export function getPhotoManifest(): PhotoManifest {
  return { ...photoManifest };
}