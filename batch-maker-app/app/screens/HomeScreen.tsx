import React from 'react';
import { View, Button, StyleSheet } from 'react-native';

export default function HomeScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <Button title="Start Workflow" onPress={() => navigation.navigate('Workflows')} />
      <Button title="Import SOP Spreadsheet" onPress={() => navigation.navigate('Import')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-evenly',
    padding: 20,
  },
});
