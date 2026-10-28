import React from 'react'
import { TextInput, Button, Grid, Stack, Text, Group, Divider } from '@mantine/core'
import LocationInput from '@/components/ui/LocationInput'

interface CarCategory {
  id: number
  name: string
  description: string
  vehicle_type: string
  seats: number
  has_ac: boolean
  base_price_per_day: number
  price_per_km: number
  features: string[]
}

interface SearchResult {
  id: string
  name: string
  address: string
  type: string
  lat?: number
  lng?: number
}

interface CarRentFormProps {
  selectedCategory: CarCategory | null
  totalPrice: number
  onSubmit: (e: React.FormEvent) => void
  processing: boolean
  formData: {
    car_category_id: string
    customer_name: string
    customer_email: string
    customer_phone: string
    start_date: string
    end_date: string
    pickup_location: string
  }
  formErrors: Record<string, string>
  onFormChange: (field: string, value: string) => void
  onLocationSelect?: (location: SearchResult) => void
}

const CarRentForm: React.FC<CarRentFormProps> = ({
  selectedCategory,
  totalPrice,
  onSubmit,
  processing,
  formData,
  formErrors,
  onFormChange,
  onLocationSelect
}) => {

  const calculateDays = () => {
    if (!formData.start_date || !formData.end_date) return 0
    const startDate = new Date(formData.start_date)
    const endDate = new Date(formData.end_date)
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  }

  const diffDays = calculateDays()
  const basePrice = selectedCategory ? selectedCategory.base_price_per_day * diffDays : 0

  return (
    <form onSubmit={onSubmit}>
      <Stack gap="xl">
        {/* Personal Information */}
        <div>
          <Group gap="xs" mb="md">
            <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <Text fw={600} size="lg" c="dark.9">Personal Information</Text>
          </Group>

          <Grid gutter="md">
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                id="customer_name"
                label="Full Name"
                placeholder="Enter your full name"
                value={formData.customer_name}
                onChange={(e) => onFormChange('customer_name', e.target.value)}
                error={formErrors.customer_name}
                required
                size="md"
                styles={{
                  input: {
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    '&:focus': {
                      borderColor: '#3b82f6',
                      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
                    },
                  },
                  label: {
                    marginBottom: '8px',
                    fontWeight: 500,
                    color: '#374151',
                  }
                }}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                id="customer_phone"
                label="Phone Number"
                placeholder="+91 XXXXX XXXXX"
                value={formData.customer_phone}
                onChange={(e) => onFormChange('customer_phone', e.target.value)}
                error={formErrors.customer_phone}
                required
                size="md"
                styles={{
                  input: {
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    '&:focus': {
                      borderColor: '#3b82f6',
                      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
                    },
                  },
                  label: {
                    marginBottom: '8px',
                    fontWeight: 500,
                    color: '#374151',
                  }
                }}
              />
            </Grid.Col>

            <Grid.Col span={12}>
              <TextInput
                id="customer_email"
                label="Email Address"
                placeholder="your.email@example.com"
                type="email"
                value={formData.customer_email}
                onChange={(e) => onFormChange('customer_email', e.target.value)}
                error={formErrors.customer_email}
                required
                size="md"
                styles={{
                  input: {
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    '&:focus': {
                      borderColor: '#3b82f6',
                      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
                    },
                  },
                  label: {
                    marginBottom: '8px',
                    fontWeight: 500,
                    color: '#374151',
                  }
                }}
              />
            </Grid.Col>
          </Grid>
        </div>

        <Divider />

        {/* Trip Details */}
        <div>
          <Group gap="xs" mb="md">
            <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <Text fw={600} size="lg" c="dark.9">Trip Details</Text>
          </Group>

          <Grid gutter="md">
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                id="start_date"
                label="Start Date"
                type="date"
                value={formData.start_date}
                onChange={(e) => onFormChange('start_date', e.target.value)}
                error={formErrors.start_date}
                required
                min={new Date().toISOString().split('T')[0]}
                size="md"
                styles={{
                  input: {
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    '&:focus': {
                      borderColor: '#3b82f6',
                      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
                    },
                  },
                  label: {
                    marginBottom: '8px',
                    fontWeight: 500,
                    color: '#374151',
                  }
                }}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                id="end_date"
                label="End Date"
                type="date"
                value={formData.end_date}
                onChange={(e) => onFormChange('end_date', e.target.value)}
                error={formErrors.end_date}
                required
                min={formData.start_date || new Date().toISOString().split('T')[0]}
                size="md"
                styles={{
                  input: {
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    '&:focus': {
                      borderColor: '#3b82f6',
                      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
                    },
                  },
                  label: {
                    marginBottom: '8px',
                    fontWeight: 500,
                    color: '#374151',
                  }
                }}
              />
            </Grid.Col>

            <Grid.Col span={12}>
              <LocationInput
                label="Pickup Location"
                placeholder="Search for pickup location (e.g., Guwahati Airport, Hotel, etc.)"
                value={formData.pickup_location}
                onChange={(value) => onFormChange('pickup_location', value)}
                onLocationSelect={onLocationSelect}
                error={formErrors.pickup_location}
                required
              />
            </Grid.Col>
          </Grid>
        </div>

        <Divider />

        {/* Price Summary */}
        {totalPrice > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
            border: '1px solid #93c5fd',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <Text fw={600} size="lg" c="dark.9" mb="md">Price Breakdown</Text>

            <Stack gap="xs" mb="md">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Base Price ({diffDays} days):</Text>
                <Text fw={500}>₹{basePrice}</Text>
              </Group>

              <Divider />

              <Group justify="space-between">
                <Text fw={600} c="dark.9">Total Price:</Text>
                <Text size="xl" fw={700} c="blue.7">₹{totalPrice}</Text>
              </Group>
            </Stack>

            <Text size="sm" c="dimmed">
              {selectedCategory && `Includes ${selectedCategory.name} with experienced driver`}
            </Text>
          </div>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          size="lg"
          fullWidth
          disabled={processing || !selectedCategory}
          styles={{
            root: {
              height: '48px',
              fontSize: '16px',
              fontWeight: 600,
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
              },
              '&:disabled': {
                background: '#9ca3af',
                cursor: 'not-allowed',
              }
            }
          }}
        >
          {processing ? (
            <Group gap="xs">
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid transparent',
                borderTop: '2px solid white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
              <Text>Processing...</Text>
            </Group>
          ) : (
            <Group gap="xs">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <Text>Book Car Rental</Text>
            </Group>
          )}
        </Button>
      </Stack>
    </form>
  )
}

export default CarRentForm