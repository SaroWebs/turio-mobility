import React from 'react'
import { Link } from '@inertiajs/react'
import { Card, Text, Group, Badge, Button, Stack, Box } from '@mantine/core'
import { Tour } from '@/types'
import { resolveMediaUrl } from '@/lib/utils'

interface TourCardProps {
  tour: Tour
}

const TourCard: React.FC<TourCardProps> = ({ tour }) => {
  const formatPrice = (price: number, discount?: number) => {
    if (discount && discount > 0) {
      const discountedPrice = price - (price * discount / 100)
      return (
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-orange-600">
            ₹{discountedPrice.toLocaleString()}
          </span>
          <span className="text-sm text-gray-500 line-through">
            ₹{price.toLocaleString()}
          </span>
          <Badge color="green" size="sm">
            {discount}% OFF
          </Badge>
        </div>
      )
    }
    return (
      <span className="text-lg font-bold text-orange-600">
        ₹{price.toLocaleString()}
      </span>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <Card
      shadow="md"
      padding="lg"
      radius="md"
      withBorder
      style={{
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)',
        }
      }}
      component={Link}
      href={`/tours/${tour.id}`}
    >
      <Card.Section>
        <Box style={{
          height: '200px',
          background: tour.image_path
            ? `url(${resolveMediaUrl(tour.image_path)})`
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {!tour.image_path && (
            <Text size="lg" c="white" fw={500}>
              {tour.title}
            </Text>
          )}
          {tour.discount && (
            <Badge
              color="red"
              size="lg"
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                fontSize: '12px',
                fontWeight: 600
              }}
            >
              {tour.discount}% OFF
            </Badge>
          )}
        </Box>
      </Card.Section>

      <Stack gap="md" mt="md">
        <div>
          <Text size="xl" fw={600} c="dark.9" lineClamp={1}>
            {tour.title}
          </Text>
          <Text size="sm" c="dimmed" lineClamp={2} mt="xs">
            {tour.description}
          </Text>
        </div>

        <Group justify="space-between" align="center">
          <div>
            {formatPrice(tour.price, tour.discount)}
          </div>
          <Badge variant="light" color="blue" size="sm">
            Available
          </Badge>
        </Group>

        <Group gap="xs">
          <Text size="sm" c="dimmed">
            Available:
          </Text>
          <Text size="sm" c="dark.9">
            {formatDate(tour.available_from)} - {formatDate(tour.available_to)}
          </Text>
        </Group>

        {tour.itineraries && tour.itineraries.length > 0 && (
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              Duration:
            </Text>
            <Text size="sm" c="dark.9">
              {Math.max(...tour.itineraries.map(i => i.day_index))} days
            </Text>
          </Group>
        )}

        <Button
          fullWidth
          size="md"
          style={{
            background: 'linear-gradient(135deg, #f57c00 0%, #e65100 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #e65100 0%, #bf360c 100%)',
            }
          }}
        >
          View Details
        </Button>
      </Stack>
    </Card>
  )
}

export default TourCard
