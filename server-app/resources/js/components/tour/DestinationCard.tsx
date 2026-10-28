import React from 'react'
import { Link } from '@inertiajs/react'
import { Card, Text, Badge, Button, Stack, Box, Group } from '@mantine/core'
import { Place } from '@/types'
import { resolveMediaUrl } from '@/lib/utils'

interface DestinationCardProps {
  place: Place
}

type DestinationMedia = {
  file_path?: string
  url?: string
}

type PlaceWithLegacyMedia = Place & {
  place_media?: DestinationMedia[]
}

const DestinationCard: React.FC<DestinationCardProps> = ({ place }) => {
  const legacyMedia = (place as PlaceWithLegacyMedia).place_media ?? []
  const media = (Array.isArray(place.media) ? place.media : legacyMedia) as DestinationMedia[]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'green'
      case 'unavailable':
        return 'red'
      case 'restricted':
        return 'orange'
      default:
        return 'gray'
    }
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
      href={`/destinations/${place.id}`}
    >
      <Card.Section>
        <Box style={{
          height: '200px',
          background: media.length > 0
            ? `url(${resolveMediaUrl(media[0].url || media[0].file_path)})`
            : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {media.length === 0 ? (
            <Text size="xl" c="white" fw={500}>
              {place.name}
            </Text>
          ) : null}

          {/* Location coordinates overlay */}
          {place.lat && place.lng && typeof place.lat === 'number' && typeof place.lng === 'number' && (
            <Badge
              color="dark"
              size="sm"
              style={{
                position: 'absolute',
                bottom: '12px',
                right: '12px',
                fontSize: '10px',
                fontWeight: 500,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: 'white'
              }}
            >
              📍 {place.lat.toFixed(3)}, {place.lng.toFixed(3)}
            </Badge>
          )}

          {/* Status badge */}
          <Badge
            color={getStatusColor(place.status)}
            size="sm"
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              fontSize: '10px',
              fontWeight: 600
            }}
          >
            {place.status.charAt(0).toUpperCase() + place.status.slice(1)}
          </Badge>
        </Box>
      </Card.Section>

      <Stack gap="md" mt="md">
        <div>
          <Text size="xl" fw={600} c="dark.9" lineClamp={1}>
            {place.name}
          </Text>
          <Text size="sm" c="dimmed" lineClamp={2} mt="xs">
            {place.description}
          </Text>
        </div>

        <Group justify="space-between" align="center">
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              Added:
            </Text>
            <Text size="sm" c="dark.9">
              {formatDate(place.created_at)}
            </Text>
          </Group>
          <Badge variant="light" color="blue" size="sm">
            Destination
          </Badge>
        </Group>

        {place.itineraries && place.itineraries.length > 0 && (
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              Featured in:
            </Text>
            <Text size="sm" c="dark.9">
              {place.itineraries.length} tour{place.itineraries.length > 1 ? 's' : ''}
            </Text>
          </Group>
        )}

        <Button
          fullWidth
          size="md"
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            }
          }}
        >
          Explore Destination
        </Button>
      </Stack>
    </Card>
  )
}

export default DestinationCard
