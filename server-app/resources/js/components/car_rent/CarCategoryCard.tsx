import React from 'react'
import { Card, Text, Group, Badge, Stack, Grid, Box } from '@mantine/core'

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

interface CarCategoryCardProps {
  category: CarCategory
  isSelected: boolean
  onClick: () => void
}

const CarCategoryCard: React.FC<CarCategoryCardProps> = ({ category, isSelected, onClick }) => {
  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      style={{
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        border: isSelected ? '2px solid #3b82f6' : '1px solid #e2e8f0',
        backgroundColor: isSelected ? '#eff6ff' : 'white',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)',
          backgroundColor: '#f9fafb',
        }
      }}
      onClick={onClick}
    >
      <Card.Section withBorder={false} inheritPadding py="xs">
        <Grid gutter="md" align="center">
          <Grid.Col span={{ base: 12, sm: 8 }}>
            <Stack gap="xs">
              <Text size="xl" fw={600} c={isSelected ? 'blue.7' : 'dark.9'}>
                {category.name}
              </Text>
              <Text size="sm" c="dimmed" lineClamp={2}>
                {category.description}
              </Text>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 4 }}>
            <Stack gap="xs" align="end">
              <Text size="xl" fw={700} c="green.7">
                ₹{category.base_price_per_day}
              </Text>
              <Text size="sm" c="dimmed">per day</Text>
            </Stack>
          </Grid.Col>
        </Grid>
      </Card.Section>

      <Stack gap="md" mt="md">
        <Group justify="space-between" align="center">
          <Group gap="lg">
            <Group gap="xs">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <Text size="sm" c="dimmed">{category.seats} seats</Text>
            </Group>

            <Group gap="xs">
              {category.has_ac ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: '#3b82f6' }}>
                  <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: '#6b7280' }}>
                  <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <Text size="sm" c="dimmed">{category.has_ac ? 'AC' : 'Non-AC'}</Text>
            </Group>
          </Group>

          <Badge variant="light" color="gray" size="sm">
            {category.vehicle_type.replace('_', ' ')}
          </Badge>
        </Group>

        {category.features && category.features.length > 0 && (
          <Group gap="xs">
            {category.features.slice(0, 3).map((feature, idx) => (
              <Badge
                key={idx}
                variant="light"
                color="blue"
                size="sm"
              >
                {feature}
              </Badge>
            ))}
            {category.features.length > 3 && (
              <Badge variant="light" color="gray" size="sm">
                +{category.features.length - 3} more
              </Badge>
            )}
          </Group>
        )}
      </Stack>
    </Card>
  )
}

export default CarCategoryCard