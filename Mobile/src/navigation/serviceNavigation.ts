import type { ServiceDestination } from '../config/servicesConfig';

type NavigationLike = {
  navigate: (screen: any, params?: any) => void;
  getParent?: <T = NavigationLike>() => T | undefined;
};

type NavigationContext = 'root' | 'services';

export function navigateToServiceDestination(
  navigation: NavigationLike,
  destination: ServiceDestination,
  context: NavigationContext = 'root',
): void {
  if (destination.navigator === 'services') {
    if (context === 'services') {
      if (destination.params) {
        navigation.navigate(destination.screen, destination.params);
      } else {
        navigation.navigate(destination.screen);
      }
      return;
    }

    navigation.navigate('Services', destination.params
      ? { screen: destination.screen, params: destination.params }
      : { screen: destination.screen });
    return;
  }

  const rootNavigation = navigation.getParent?.<NavigationLike>();
  const target = rootNavigation ?? navigation;

  if (destination.params) {
    target.navigate(destination.screen, destination.params);
  } else {
    target.navigate(destination.screen);
  }
}

export function navigateToServicesHome(navigation: NavigationLike): void {
  navigation.navigate('Services', { screen: 'ServicesHome' });
}
