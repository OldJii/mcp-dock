/**
 * 配置表单组件 - Surge 风格
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface ConfigSchema {
  type: string;
  properties: Record<string, {
    type: string;
    description?: string;
    default?: any;
    enum?: string[];
  }>;
  required: string[];
}

interface ConfigFormProps {
  schema: ConfigSchema;
  initialValues?: Record<string, any>;
  onSubmit: (values: Record<string, any>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function ConfigForm({
  schema,
  initialValues = {},
  onSubmit,
  onCancel,
  isLoading = false,
}: ConfigFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const initial: Record<string, any> = {};
    Object.entries(schema.properties || {}).forEach(([key, prop]) => {
      initial[key] = initialValues[key] ?? prop.default ?? '';
    });
    setValues(initial);
  }, [schema, initialValues]);

  const handleChange = (key: string, value: any) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: Record<string, string> = {};
    schema.required?.forEach((key) => {
      if (!values[key] || (typeof values[key] === 'string' && !values[key].trim())) {
        newErrors[key] = 'Required';
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const filteredValues: Record<string, any> = {};
    Object.entries(values).forEach(([key, value]) => {
      if (value !== '' && value !== undefined && value !== null) {
        filteredValues[key] = value;
      }
    });

    onSubmit(filteredValues);
  };

  const properties = Object.entries(schema.properties || {});

  if (properties.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-[13px] text-[#98989d] mb-4">No configuration required</p>
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary"
          >
            {t('detail.cancel')}
          </button>
          <button
            onClick={() => onSubmit({})}
            disabled={isLoading}
            className="btn btn-primary disabled:opacity-50"
          >
            {isLoading ? t('common.loading') : t('detail.save')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {properties.map(([key, prop]) => {
        const isRequired = schema.required?.includes(key);
        const hasError = !!errors[key];

        return (
          <div key={key}>
            <label className="block mb-1">
              <span className="text-[12px] font-medium text-white">
                {key}
              </span>
              {isRequired ? (
                <span className="ml-1 text-[10px] text-[#ff3b30]">*</span>
              ) : (
                <span className="ml-1 text-[10px] text-[#636366]">({t('detail.optional')})</span>
              )}
            </label>
            
            {prop.description && (
              <p className="text-[11px] text-[#636366] mb-1.5">{prop.description}</p>
            )}

            {prop.enum ? (
              <select
                value={values[key] || ''}
                onChange={(e) => handleChange(key, e.target.value)}
                className={`
                  w-full px-3 py-2 rounded-md bg-[#1c1c1e] border text-[13px] text-white
                  transition-colors
                  ${hasError 
                    ? 'border-[#ff3b30]' 
                    : 'border-[#3a3a3c] focus:border-[#0a84ff]'
                  }
                `}
              >
                <option value="">Select...</option>
                {prop.enum.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            ) : prop.type === 'boolean' ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={values[key] || false}
                  onChange={(e) => handleChange(key, e.target.checked)}
                  className="w-4 h-4 rounded border-[#3a3a3c] bg-[#1c1c1e] text-[#0a84ff] focus:ring-[#0a84ff]/50"
                />
                <span className="text-[12px] text-[#98989d]">Enable</span>
              </label>
            ) : prop.type === 'number' || prop.type === 'integer' ? (
              <input
                type="number"
                value={values[key] || ''}
                onChange={(e) => handleChange(key, e.target.value ? Number(e.target.value) : '')}
                placeholder={prop.default?.toString()}
                className={`
                  w-full px-3 py-2 rounded-md bg-[#1c1c1e] border text-[13px] text-white
                  placeholder:text-[#636366] transition-colors
                  ${hasError 
                    ? 'border-[#ff3b30]' 
                    : 'border-[#3a3a3c] focus:border-[#0a84ff]'
                  }
                `}
              />
            ) : (
              <input
                type={key.toLowerCase().includes('password') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('token') || key.toLowerCase().includes('key') ? 'password' : 'text'}
                value={values[key] || ''}
                onChange={(e) => handleChange(key, e.target.value)}
                placeholder={prop.default?.toString() || `Enter ${key}...`}
                className={`
                  w-full px-3 py-2 rounded-md bg-[#1c1c1e] border text-[13px] text-white
                  placeholder:text-[#636366] transition-colors
                  ${hasError 
                    ? 'border-[#ff3b30]' 
                    : 'border-[#3a3a3c] focus:border-[#0a84ff]'
                  }
                `}
              />
            )}

            {hasError && (
              <p className="mt-1 text-[11px] text-[#ff3b30]">{errors[key]}</p>
            )}
          </div>
        );
      })}

      <div className="flex justify-end gap-2 pt-3 border-t border-[#3a3a3c]">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary"
        >
          {t('detail.cancel')}
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="btn btn-primary disabled:opacity-50"
        >
          {isLoading ? t('common.loading') : t('detail.save')}
        </button>
      </div>
    </form>
  );
}
