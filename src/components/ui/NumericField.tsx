/**
 * Numeric TextInput with string draft state — supports comma/dot decimals.
 * Never binds a parsed number directly to value=.
 */

import React from 'react';
import { TextField } from '@/src/components/ui/TextField';
import type { TextInputProps } from 'react-native';

type NumericFieldProps = Omit<TextInputProps, 'value' | 'onChangeText' | 'keyboardType'> & {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string | null;
};

export function NumericField({
  label,
  value,
  onChangeText,
  error,
  ...rest
}: NumericFieldProps) {
  return (
    <TextField
      label={label}
      value={value}
      onChangeText={onChangeText}
      error={error}
      keyboardType="decimal-pad"
      {...rest}
    />
  );
}

export default NumericField;
