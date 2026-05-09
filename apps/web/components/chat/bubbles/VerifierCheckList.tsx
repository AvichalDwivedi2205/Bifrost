'use client';
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { VerificationCheck } from '@bifrost/shared';
import { VerificationCheckRow } from '../../VerificationCheckRow';
import { verifierStagger, verifierChild, shakeFail } from '../bubbleVariants';

export interface VerifierCheckListProps {
  checks: VerificationCheck[];
}

export default function VerifierCheckList({ checks }: VerifierCheckListProps) {
  const reduce = useReducedMotion();
  return (
    <motion.ul
      variants={verifierStagger}
      initial="hidden"
      animate="visible"
      style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      {checks.map((check) => {
        const failed = check.status === 'failed';
        const shouldShake = failed && !reduce;
        return (
          <motion.li key={check.id} variants={verifierChild} style={{ margin: 0 }}>
            <motion.div
              variants={shouldShake ? shakeFail : undefined}
              initial="initial"
              animate={shouldShake ? 'shake' : 'initial'}
            >
              <VerificationCheckRow
                label={check.label}
                passed={check.status === 'passed'}
                detail={check.detail}
              />
            </motion.div>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}
