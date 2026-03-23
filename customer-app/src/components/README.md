# Customer App Components

## SuccessToast

A reusable success notification component that displays a green toast message with a checkmark icon.

### Features

- ✅ Smooth slide-down animation from top
- ✅ Auto-dismiss after configurable duration (default: 1000ms)
- ✅ Success styling with green background and white text
- ✅ Checkmark icon for visual feedback
- ✅ Responsive design for different screen sizes
- ✅ Platform-specific positioning (iOS/Android)

### Usage

```tsx
import SuccessToast from '../components/SuccessToast';

const [showToast, setShowToast] = useState(false);

<SuccessToast
  visible={showToast}
  message="Request sent successfully!"
  onHide={() => setShowToast(false)}
  duration={1000} // optional, defaults to 1000ms
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `visible` | `boolean` | - | Controls toast visibility |
| `message` | `string` | - | Text to display in the toast |
| `onHide` | `() => void` | - | Callback when toast is hidden |
| `duration` | `number` | `1000` | Auto-hide duration in milliseconds |

### Integration Example

The SuccessToast is currently integrated in the Home screen for drop request confirmation:

```tsx
// In Home.tsx
const [showSuccessToast, setShowSuccessToast] = useState(false);

// In swipe success handler
onSwipeSuccess={async () => {
  // Show success toast
  setShowSuccessToast(true);
  
  // Send the drop request
  await requestVehicleDrop(undefined, token || undefined);
  
  // Navigate after delay to show toast
  setTimeout(() => {
    navigation.navigate('TrackVehicle');
  }, 1200);
}}

// In JSX
<SuccessToast
  visible={showSuccessToast}
  message="Request sent successfully!"
  onHide={() => setShowSuccessToast(false)}
  duration={1000}
/>
```

### Styling

The component uses a green success theme:
- Background: `#10B981` (green-500)
- Text: White
- Icon: White checkmark in semi-transparent circle
- Shadow: Subtle drop shadow for depth
- Border radius: 12px for modern look

### Animation

- **Show**: Slides down from top with scale and fade-in
- **Hide**: Slides up and fades out
- **Duration**: 300ms for show, 250ms for hide
- **Spring**: Scale animation uses spring physics for natural feel
