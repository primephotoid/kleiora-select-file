'use client';

import { PricelistGallery } from '@/components/PricelistGallery';
import { RegionSwitcher } from '@/components/RegionSwitcher';
import { PackageItem } from '@/lib/api';
import { useRegion } from '@/lib/useRegion';

interface Props {
  packages: PackageItem[];
  subtitle?: string;
  title?: string;
}

export function HomePricelist({ packages, subtitle, title }: Props) {
  const { region, setRegion, detecting } = useRegion();

  return (
    <div>
      <RegionSwitcher region={region} detecting={detecting} onSwitch={setRegion} />
      <PricelistGallery
        packages={packages}
        subtitle={subtitle}
        title={title}
        region={region}
      />
    </div>
  );
}
